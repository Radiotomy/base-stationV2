// generateMusicAurora — submits a song render to Aurora (our self-hosted
// MiniMax-Music3 engine) and returns immediately with a job id. The render is
// polled by pollAuroraJob, because a five-minute song takes minutes of GPU time
// and a synchronous wait would blow the function timeout.
//
// Credits are CHECKED here but only DEDUCTED on completion, so a render that
// never lands costs the creator nothing.
//
// Deliberately separate from the MiniMax family reachable through the Tempolor
// API (provider 'tempcolor'): that is a third-party hosted service on its own
// contract and pricing, this is our own deployment of the open weights. Merging
// them would make a provenance record unable to say which one produced a track.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  submitAuroraJob, auroraBalance, screenAuroraRequest,
  AURORA_COST, AURORA_MIN_DURATION, AURORA_MAX_DURATION, AURORA_DEFAULT_DURATION,
  AURORA_MODEL_ID, AURORA_MODEL_LABEL,
} from '../../shared/auroraEngine.ts';
import { releaseMetadata } from '../../shared/trackMetadata.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, lyrics, duration, seed, title, caption_mode, caption_fields, genre, mood } = await req.json();

    if (!prompt || !String(prompt).trim()) {
      return Response.json({ error: 'A music description is required' }, { status: 400 });
    }

    // Structured Caption / prose is a single text channel to the model, so the
    // only safe normalization is trimming — reflowing it would change what the
    // text encoder reads. The block layout's newlines are preserved on purpose.
    const safePrompt = String(prompt).trim().slice(0, 4000);
    const safeLyrics = lyrics && String(lyrics).trim() ? String(lyrics).trim().slice(0, 6000) : '';

    // Licence clause 4 safeguard — screened BEFORE any GPU time is spent.
    const refusal = screenAuroraRequest(safePrompt, safeLyrics);
    if (refusal) {
      return Response.json({
        error: `This request can't be generated: ${refusal}. Aurora runs under the MiniMax-Music3 Acceptable Use Policy.`,
      }, { status: 400 });
    }

    const numDur = Number(duration);
    const safeDuration = Number.isFinite(numDur)
      ? Math.min(Math.max(Math.round(numDur), AURORA_MIN_DURATION), AURORA_MAX_DURATION)
      : AURORA_DEFAULT_DURATION;

    const numSeed = Number(seed);
    const safeSeed = Number.isFinite(numSeed) && numSeed > 0 ? Math.round(numSeed) : 42;

    const cost = AURORA_COST;
    const { balance } = await auroraBalance(base44, user.id);
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits', required: cost, balance,
        message: `Aurora generation costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    let submitted;
    try {
      submitted = await submitAuroraJob({
        prompt: safePrompt,
        lyrics: safeLyrics,
        duration: safeDuration,
        seed: safeSeed,
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'aurora',
      status: 'processing',
      ai_label: 'ai_generated',
      input_data: {
        prompt: safePrompt,
        lyrics: safeLyrics,
        duration: safeDuration, seed: safeSeed,
        title: title || '', credit_cost: cost,
        engine: 'hf_space',
        model: AURORA_MODEL_LABEL,
        model_id: AURORA_MODEL_ID,
        // Release metadata — distinct from the caption's own genre wording, which
        // is conditioning text. Normalized at submit so the library and every
        // distribution channel read one already-valid value.
        ...releaseMetadata({ genre, mood }),
        // How the creator authored the description. Recorded because a structured
        // caption and a prose paragraph are different authorship inputs, and the
        // COS engine reads the difference rather than guessing at it.
        caption_mode: caption_mode === 'prose' ? 'prose' : 'structured',
        ...(caption_fields && typeof caption_fields === 'object' ? { caption_fields } : {}),
      },
      provider_job_id: submitted.jobId,
      started_at: new Date().toISOString(),
    });

    return Response.json({
      job_id: job.id,
      provider_job_id: submitted.jobId,
      status: 'processing',
      credit_cost: cost,
      duration: safeDuration,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});