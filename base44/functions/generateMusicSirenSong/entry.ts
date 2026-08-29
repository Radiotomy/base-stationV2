// generateMusicSirenSong — submits a job to the Siren Song (HeartMuLa 3B) audio
// engine on our Hugging Face Space and returns immediately with a job id. The
// render itself is polled by pollSirenSongJob (submit-and-poll), because the L4
// GPU runs at RTF ~1.0 and a synchronous wait would blow the function timeout.
//
// Credits are checked here but only DEDUCTED on completion (in pollSirenSongJob),
// so a job that never renders costs nothing.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { submitSirenSongAudio, sirenBalance, SIREN_SONG_COST } from '../../shared/sirenSongHf.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tags, lyrics, max_audio_length_ms, seed, title } = await req.json();
    if (!tags || !String(tags).trim()) {
      return Response.json({ error: 'At least one style tag is required' }, { status: 400 });
    }

    // Normalize to the model's conditioning contract: comma-separated tokens,
    // lowercased, no spaces after commas, no wrapping markers (the pipeline
    // lowercases and wraps tags itself).
    const safeTags = String(tags)
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      .join(',').slice(0, 400);
    if (!safeTags) return Response.json({ error: 'At least one style tag is required' }, { status: 400 });

    const safeLyrics = lyrics && String(lyrics).trim() ? String(lyrics).slice(0, 4000) : '';

    // RTF ~1.0 — a longer ceiling is proportionally more GPU time. Cap at 60s.
    const numMs = Number(max_audio_length_ms);
    const safeMs = Number.isFinite(numMs) ? Math.min(Math.max(numMs, 5000), 60000) : 30000;

    const numSeed = Number(seed);
    const safeSeed = Number.isFinite(numSeed) && numSeed > 0 ? Math.round(numSeed) : 42;

    const cost = SIREN_SONG_COST;
    const { balance } = await sirenBalance(base44, user.id);
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits', required: cost, balance,
        message: `Siren Song generation costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    let submitted;
    try {
      submitted = await submitSirenSongAudio({ tags: safeTags, lyrics: safeLyrics, maxMs: safeMs, seed: safeSeed });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }

    const startedAt = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'sirensong',
      status: 'processing',
      ai_label: 'ai_generated',
      input_data: {
        tags: safeTags, lyrics: safeLyrics,
        max_audio_length_ms: safeMs, seed: safeSeed,
        title: title || '', credit_cost: cost,
        engine: 'hf_space', model: 'HeartMuLa 3B',
      },
      provider_job_id: submitted.jobId,
      started_at: startedAt,
    });

    return Response.json({
      job_id: job.id,
      provider_job_id: submitted.jobId,
      status: 'processing',
      credit_cost: cost,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});