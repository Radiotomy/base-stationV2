// pollSirenSongJob — one status read for a Siren Song generation. Called
// repeatedly by the studio while the L4 GPU renders. On completion it persists
// the WAV into Base44 storage, saves it to the creator's library, deducts
// credits and flips the job to 'completed'.
//
// Idempotent: a job already 'completed' or 'failed' returns its cached result
// and never re-charges or re-saves. The studio polls STRICTLY SEQUENTIALLY (it
// schedules the next read only after the previous resolves), so two overlapping
// finalizations cannot happen for one job.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getSirenSongStatus, persistSirenSongWav, sirenDeduct } from '../../shared/sirenSongHf.ts';
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

    // Terminal states short-circuit — never re-finalize a settled job.
    if (job.status === 'completed') {
      return Response.json({
        status: 'completed', job_id: job.id,
        audio_url: job.output_url,
        asset_id: job.output_metadata?.asset_id || null,
      });
    }
    if (job.status === 'failed') {
      return Response.json({ status: 'failed', job_id: job.id, error: job.error_message || 'Generation failed' });
    }

    let st;
    try {
      st = await getSirenSongStatus(job.provider_job_id);
    } catch {
      // Transient status hiccup — keep the job processing so the studio retries.
      return Response.json({ status: 'processing', job_id: job.id, progress: 'Rendering…' });
    }

    if (st.status === 'lost' || st.status === 'failed' || st.status === 'error') {
      const detail = st.status === 'lost'
        ? 'The Siren Song engine restarted before this render could be stored, so the audio was lost. No credits were charged — please regenerate.'
        : (st.error || st.progress || 'Siren Song generation failed');
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: detail,
        completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', job_id: job.id, error: detail });
    }

    if (st.status !== 'completed') {
      return Response.json({ status: 'processing', job_id: job.id, progress: st.progress || 'Rendering…' });
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
      || String(job.input_data?.tags || 'Siren Song').split(',')[0]
      || 'Siren Song';
    let fileUrl;
    try {
      fileUrl = await persistSirenSongWav(base44, st.downloadUrl, title);
    } catch (err) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: err.message, completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', job_id: job.id, error: err.message });
    }

    const completedAt = new Date().toISOString();

    // Cover artwork — a Siren Song render is a SONG, so it gets album art like
    // every other track. This path finalizes itself instead of going through the
    // shared job finalizer, which is why it had no artwork at all. Never fatal:
    // the audio is already rendered and paid for, so a failed image returns null
    // and the track still saves and plays.
    const coverUrl = await generateTrackCover(base44, {
      title,
      tags: job.input_data?.tags || '',
    });

    // Save to the creator's library. base_mark is set to a skip sentinel so the
    // "Auto BASE Mark V2 on new audio assets" workflow does NOT fire: Siren Song
    // emits 48kHz float WAV, a rate the V2 detector currently cannot recover a
    // mark from — marking it would embed an unrecoverable watermark, which is
    // worse than none. (48kHz ingest policy is the open decision in the Siren
    // Song integration doc.)
    const asset = await base44.entities.UserAsset.create({
      user_id: user.id, user_email: user.email,
      asset_type: 'track',
      title,
      file_url: fileUrl,
      thumbnail_url: coverUrl || '',
      is_public: false,
      ai_label: 'ai_generated',
      ...cos,
      ai_disclosure_basis: 'Generated end-to-end by the Siren Song (HeartMuLa) model from style tags and lyrics. '
        + cos.ai_disclosure_basis,
      metadata: {
        provider: 'sirensong', engine: 'hf_space', model: 'HeartMuLa 3B',
        tags: job.input_data?.tags || '',
        lyrics: job.input_data?.lyrics || '',
        seed: job.input_data?.seed,
        max_audio_length_ms: job.input_data?.max_audio_length_ms,
        sample_rate: 48000, format: 'wav',
        generated_at: completedAt,
        generation_job_id: job.id,
        base_mark: { skipped: true, reason: 'siren_song_48khz_pending_ingest_policy' },
      },
    }).catch((e) => { console.warn('Asset save failed:', e.message); return null; });

    await base44.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: fileUrl,
      output_metadata: {
        format: 'wav', sample_rate: 48000, model_version: 'HeartMuLa 3B',
        asset_id: asset?.id || null,
        cover_image_url: coverUrl || null,
      },
      credits_used: job.input_data?.credit_cost || 0,
      completed_at: completedAt,
    });

    const cost = job.input_data?.credit_cost || 0;
    let remaining = null;
    if (cost > 0) remaining = await sirenDeduct(base44, user, cost, job.id);

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