// generateMusicSkye — submits a job to Skye (our DiffRhythm 2 fork) on its
// Hugging Face Space and returns immediately with a job id. The render is polled
// by pollSkyeJob (submit-and-poll), because a long-form render can run for
// minutes and a synchronous wait would blow the function timeout.
//
// Credits are checked here but only DEDUCTED on completion (in pollSkyeJob), so
// a job that never renders costs nothing.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  submitSkyeAudio, skyeBalance,
  SKYE_COST, SKYE_MIN_DURATION, SKYE_MAX_DURATION, SKYE_DEFAULT_DURATION,
  SKYE_DEFAULT_NEGATIVE,
} from '../../shared/skyeEngine.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      style_prompt, negative_style_prompt, lyrics,
      reference_audio_url, duration, seed, title,
    } = await req.json();

    if (!style_prompt || !String(style_prompt).trim()) {
      return Response.json({ error: 'A style prompt is required' }, { status: 400 });
    }

    // Prose channel — kept as written. Unlike Siren Song's tag channel there is
    // nothing to tokenize here; collapsing whitespace is the only normalization
    // that cannot change the meaning the text encoder reads.
    const safeStyle = String(style_prompt).replace(/\s+/g, ' ').trim().slice(0, 600);
    const safeNegative = negative_style_prompt && String(negative_style_prompt).trim()
      ? String(negative_style_prompt).replace(/\s+/g, ' ').trim().slice(0, 400)
      : SKYE_DEFAULT_NEGATIVE;

    // Lyrics pass through untouched: LRC timestamps ("[00:12.50] line") are
    // load-bearing for phonetic alignment, so reformatting them would break it.
    const safeLyrics = lyrics && String(lyrics).trim() ? String(lyrics).slice(0, 6000) : '';

    // Clamped to the model's real floor, not 10s: DiffRhythm 2 cannot render
    // below 95s, so a shorter request was previously forwarded straight to the
    // engine to be rejected or padded.
    const numDur = Number(duration);
    const safeDuration = Number.isFinite(numDur)
      ? Math.min(Math.max(Math.round(numDur), SKYE_MIN_DURATION), SKYE_MAX_DURATION)
      : SKYE_DEFAULT_DURATION;

    const numSeed = Number(seed);
    const safeSeed = Number.isFinite(numSeed) && numSeed > 0 ? Math.round(numSeed) : 42;

    // Only https URLs are forwarded — the Space fetches this itself, so an
    // arbitrary scheme or internal host must never reach it.
    let safeRef = '';
    if (reference_audio_url && String(reference_audio_url).trim()) {
      const raw = String(reference_audio_url).trim();
      if (!/^https:\/\//i.test(raw)) {
        return Response.json({ error: 'Reference audio must be a public https URL' }, { status: 400 });
      }
      safeRef = raw.slice(0, 1000);
    }

    const cost = SKYE_COST;
    const { balance } = await skyeBalance(base44, user.id);
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits', required: cost, balance,
        message: `Skye generation costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    let submitted;
    try {
      submitted = await submitSkyeAudio({
        lyrics: safeLyrics,
        stylePrompt: safeStyle,
        negativeStylePrompt: safeNegative,
        referenceAudioUrl: safeRef,
        duration: safeDuration,
        seed: safeSeed,
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'skye',
      status: 'processing',
      ai_label: 'ai_generated',
      input_data: {
        style_prompt: safeStyle,
        negative_style_prompt: safeNegative,
        lyrics: safeLyrics,
        reference_audio_url: safeRef,
        duration: safeDuration, seed: safeSeed,
        title: title || '', credit_cost: cost,
        engine: 'hf_space', model: 'DiffRhythm 2 (Skye)',
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