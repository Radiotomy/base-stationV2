// pollAuroraJob — one status read for an Aurora (MiniMax-Music3) render. Called
// repeatedly by the studio while the Space works. On completion it persists the
// 32kHz stereo WAV into Base44 storage, generates cover art, saves the track to
// the creator's library, deducts credits and flips the job to 'completed'.
//
// Idempotent: a settled job returns its cached result and never re-charges or
// re-saves. The studio polls STRICTLY SEQUENTIALLY, so two finalizations cannot
// overlap for one job.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getAuroraStatus, persistAuroraWav, auroraDeduct,
  AURORA_MODEL_ID, AURORA_MODEL_LABEL,
} from '../../shared/auroraEngine.ts';
import { generateTrackCover } from '../../shared/trackCoverArt.ts';
import { cosForJob } from '../../shared/cosStamp.ts';

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
      st = await getAuroraStatus(job.provider_job_id);
    } catch {
      // Transient status hiccup — stay processing so the studio retries.
      return Response.json({ status: 'processing', job_id: job.id, progress: 'Rendering…' });
    }

    const fail = async (detail: string) => {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: detail, completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', job_id: job.id, error: detail });
    };

    if (st.status === 'lost') {
      return await fail('The Aurora engine no longer has a record of this render, so the audio was lost. No credits were charged — please resubmit.');
    }
    if (st.status === 'failed' || st.status === 'error') {
      return await fail(st.error || st.progress || 'Aurora generation failed');
    }
    if (st.status !== 'completed') {
      return Response.json({
        status: 'processing', job_id: job.id,
        progress: st.progress || 'Composing with MiniMax-Music3…',
      });
    }
    if (!st.downloadUrl) {
      return await fail('Engine reported completed but returned no download URL');
    }

    // ── Persist ──────────────────────────────────────────────────────────────
    const title = (job.input_data?.title || '').trim()
      || String(job.input_data?.prompt || 'Aurora Track').split('\n')[0].replace(/^[A-Za-z ]+:\s*/, '').slice(0, 60)
      || 'Aurora Track';

    let persisted;
    try {
      persisted = await persistAuroraWav(
        base44, st.downloadUrl, title, Number(job.input_data?.duration) || 0,
      );
    } catch (err) {
      return await fail(err.message);
    }

    const fileUrl = persisted.fileUrl;
    const completedAt = new Date().toISOString();

    // Album artwork — never fatal: the song already rendered, so a failed image
    // returns null and the track still saves and plays.
    const coverUrl = await generateTrackCover(base44, {
      title,
      prompt: job.input_data?.prompt || '',
    });

    // Creative Ownership Score — scored by the shared engine off this job's own
    // telemetry, so an Aurora track carries a real recorded score rather than a
    // bare label. The structured caption's own fields are surfaced as style
    // signals: on Aurora they ARE the creator's musical direction.
    const captionFields = job.input_data?.caption_fields || {};
    const { fields: cos } = cosForJob({
      input_data: {
        ...job.input_data,
        genre: captionFields.genre || '',
        mood: captionFields.emotional_progression || '',
        style: captionFields.production || '',
      },
    });

    const asset = await base44.entities.UserAsset.create({
      user_id: user.id, user_email: user.email,
      asset_type: 'track',
      title,
      file_url: fileUrl,
      thumbnail_url: coverUrl || '',
      is_public: false,
      ai_label: 'ai_generated',
      ...cos,
      ai_disclosure_basis: `Generated end-to-end by Aurora, BASE Station's self-hosted deployment of ${AURORA_MODEL_ID}, from a creator-authored music description`
        + (job.input_data?.lyrics ? ' and creator-supplied lyrics. ' : '. ')
        + cos.ai_disclosure_basis,
      metadata: {
        provider: 'aurora', engine: 'hf_space',
        model: AURORA_MODEL_LABEL,
        model_id: AURORA_MODEL_ID,
        // Attribution is a licence condition (MiniMax-Music3 COMMUNITY LICENSE
        // clause 3.1), so it is recorded on the asset itself rather than living
        // only in UI copy that a future redesign could drop.
        model_attribution: 'MiniMax-Music3',
        model_license: 'MiniMax-Music3 COMMUNITY LICENSE',
        prompt: job.input_data?.prompt || '',
        caption_mode: job.input_data?.caption_mode || 'structured',
        caption_fields: job.input_data?.caption_fields || null,
        lyrics: job.input_data?.lyrics || '',
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
        format: 'wav',
        model_version: AURORA_MODEL_LABEL,
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
    if (cost > 0) remaining = await auroraDeduct(base44, user, cost, job.id);

    return Response.json({
      status: 'completed', job_id: job.id,
      audio_url: fileUrl,
      cover_image_url: coverUrl || null,
      asset_id: asset?.id || null,
      sample_rate: persisted.sampleRate,
      credits_used: cost,
      credits_remaining: remaining,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});