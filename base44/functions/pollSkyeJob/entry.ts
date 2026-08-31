// pollSkyeJob — one status read for a Skye (DiffRhythm 2) generation. Called
// repeatedly by the studio while the Space renders. On completion it persists the
// WAV into Base44 storage, generates cover art, saves the track to the creator's
// library, deducts credits and flips the job to 'completed'.
//
// Idempotent: a job already 'completed' or 'failed' returns its cached result and
// never re-charges or re-saves. The studio polls STRICTLY SEQUENTIALLY, so two
// overlapping finalizations cannot happen for one job.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getSkyeStatus, persistSkyeWav, skyeDeduct,
  SKYE_CFG_STRENGTH, SKYE_SAMPLE_STEPS,
} from '../../shared/skyeEngine.ts';
import { generateTrackCover } from '../../shared/trackCoverArt.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id } = await req.json();
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const job = await base44.entities.GenerationJob.get(job_id).catch(() => null);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Terminal states short-circuit — never re-finalize a settled job.
    if (job.status === 'completed') {
      return Response.json({
        status: 'completed', job_id: job.id,
        audio_url: job.output_url,
        cover_image_url: job.output_metadata?.cover_image_url || null,
        asset_id: job.output_metadata?.asset_id || null,
      });
    }
    if (job.status === 'failed') {
      return Response.json({ status: 'failed', job_id: job.id, error: job.error_message || 'Generation failed' });
    }

    let st;
    try {
      st = await getSkyeStatus(job.provider_job_id);
    } catch {
      // Transient status hiccup — keep the job processing so the studio retries.
      return Response.json({ status: 'processing', job_id: job.id, progress: 'Rendering…' });
    }

    if (st.status === 'failed' || st.status === 'error') {
      const detail = st.error || st.progress || 'Skye generation failed';
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: detail, completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', job_id: job.id, error: detail });
    }

    if (st.status !== 'completed') {
      return Response.json({
        status: 'processing', job_id: job.id,
        progress: st.progress || 'Executing DiffRhythm 2 inference…',
      });
    }

    if (!st.downloadUrl) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: 'Engine reported completed but returned no download URL',
        completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', job_id: job.id, error: 'No output URL' });
    }

    // ── Persist ──────────────────────────────────────────────────────────────
    const title = (job.input_data?.title || '').trim()
      || String(job.input_data?.style_prompt || 'Skye Track').split(',')[0].slice(0, 60)
      || 'Skye Track';

    let persisted;
    try {
      persisted = await persistSkyeWav(
        base44, st.downloadUrl, title, Number(job.input_data?.duration) || 0,
      );
    } catch (err) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: err.message, completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', job_id: job.id, error: err.message });
    }

    const fileUrl = persisted.fileUrl;
    const completedAt = new Date().toISOString();

    // NOTE ON 48kHz: this used to skip BASE Mark for 48kHz renders, on the
    // premise that the V2 detector could not recover a mark from a 48kHz master.
    // That premise was measured and is false for the current V2 container, which
    // embeds via a 44.1kHz DELTA added back to the untouched master (see
    // src/docs/basemark-v2-neural/predict.py). Benchmarked 2026-08-31 at 48kHz vs
    // a 44.1kHz baseline: neural recovery succeeded on an untouched file and
    // through 15kHz band-limiting at BOTH rates, and the marked file came back at
    // 48kHz with its rate, depth and channel count intact.
    //
    // So Skye renders are now marked like any other track and the "Auto BASE Mark
    // V2 on new audio assets" workflow picks them up normally. The guard is gone
    // rather than inverted: with the header reader fixed it would finally have
    // started firing, which would have disabled marking that demonstrably works.

    // Album artwork — a Skye render is a SONG, so it gets cover art like every
    // other track. Never fatal: the audio already rendered, so a failed image
    // returns null and the track still saves and plays.
    const coverUrl = await generateTrackCover(base44, {
      title,
      prompt: job.input_data?.style_prompt || '',
    });

    const usedReference = !!job.input_data?.reference_audio_url;

    const asset = await base44.entities.UserAsset.create({
      user_id: user.id, user_email: user.email,
      asset_type: 'track',
      title,
      file_url: fileUrl,
      thumbnail_url: coverUrl || '',
      is_public: false,
      ai_label: 'ai_generated',
      ai_disclosure_label: 'ai_generated',
      ai_disclosure_basis: 'Generated end-to-end by Skye (our DiffRhythm 2 fork) from a style prompt'
        + (job.input_data?.lyrics ? ' and creator-supplied lyrics.' : '.'),
      metadata: {
        provider: 'skye', engine: 'hf_space', model: 'DiffRhythm 2 (Skye)',
        style_prompt: job.input_data?.style_prompt || '',
        lyrics: job.input_data?.lyrics || '',
        cfg_strength: SKYE_CFG_STRENGTH,
        sample_steps: SKYE_SAMPLE_STEPS,
        reference_style_cloned: usedReference,
        reference_audio_url: job.input_data?.reference_audio_url || '',
        duration: job.input_data?.duration,
        seed: job.input_data?.seed,
        format: 'wav',
        sample_rate: persisted.sampleRate,
        channels: persisted.channels,
        bit_depth: persisted.bitDepth,
        generated_at: completedAt,
        generation_job_id: job.id,
      },
    }).catch((e) => { console.warn('Asset save failed:', e.message); return null; });

    await base44.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: fileUrl,
      output_metadata: {
        format: 'wav', model_version: 'DiffRhythm 2 (Skye)',
        sample_rate: persisted.sampleRate,
        duration: job.input_data?.duration,
        asset_id: asset?.id || null,
        cover_image_url: coverUrl || null,
      },
      credits_used: job.input_data?.credit_cost || 0,
      completed_at: completedAt,
    });

    const cost = job.input_data?.credit_cost || 0;
    let remaining = null;
    if (cost > 0) remaining = await skyeDeduct(base44, user, cost, job.id);

    return Response.json({
      status: 'completed', job_id: job.id,
      audio_url: fileUrl,
      cover_image_url: coverUrl || null,
      asset_id: asset?.id || null,
      credits_used: cost,
      credits_remaining: remaining,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});