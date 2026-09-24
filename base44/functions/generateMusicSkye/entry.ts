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
} from '../../shared/skyeEngine.ts';
import { releaseMetadata } from '../../shared/trackMetadata.ts';

// Fold the chosen genre/mood into the prose style prompt. DiffRhythm 2 reads
// style as a single MuLan text embedding, so a genre/mood pick that lives only
// in release metadata steers the sound not at all. Leading with a genre/mood
// clause puts that steering in front of the model; tokens the creator already
// named are skipped so a detailed prompt isn't doubled.
function enrichSkyeStyle(prose, genre, mood) {
  const p = (prose || '').trim();
  const lower = p.toLowerCase();
  const add = [];
  if (mood) {
    const m = mood.toLowerCase();
    if (!lower.includes(m)) add.push(m);
  }
  if (genre) {
    const g = genre.toLowerCase().replace('/', ' ');
    const tokens = g.split(/[\s-]+/).filter((t) => t.length > 2);
    const present = tokens.some((t) => lower.includes(t));
    if (!present) add.push(g);
  }
  if (!add.length) return p;
  return `${add.join(' ')}. ${p}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      style_prompt, lyrics,
      reference_audio_url, duration, seed, title,
      cfg_strength, sample_steps, genre, mood,
    } = await req.json();

    // Calibration overrides — admin only. Creators always get the calibrated
    // defaults; the sweep dials exist so a vocal/instrumental tuning pass can be
    // A/B'd on the same seed without touching the shared engine constants.
    const isAdmin = user.role === 'admin';
    const numCfg = Number(cfg_strength), numSteps = Number(sample_steps);
    const cfgOverride = isAdmin && Number.isFinite(numCfg) ? numCfg : undefined;
    const stepsOverride = isAdmin && Number.isFinite(numSteps) ? numSteps : undefined;

    const hasPrompt = !!(style_prompt && String(style_prompt).trim());
    const hasRef = !!(reference_audio_url && String(reference_audio_url).trim());

    // The rebuilt Space (2026-08-30) exposes no reference-audio channel, so a
    // reference is rejected loudly rather than sent to an engine that would
    // silently ignore it and render from nothing.
    if (hasRef) {
      return Response.json({
        error: 'Reference-audio style cloning is not available in the current Skye engine build — use a written style prompt instead.',
      }, { status: 400 });
    }
    if (!hasPrompt) {
      return Response.json({ error: 'A style prompt is required' }, { status: 400 });
    }

    // Prose channel. Unlike Siren Song's tag channel there is nothing to
    // tokenize here; collapsing whitespace is the only normalization that
    // cannot change the meaning the text encoder reads.
    const rawStyle = String(style_prompt).replace(/\s+/g, ' ').trim().slice(0, 600);

    // Genre/mood are release metadata, but DiffRhythm 2's ONLY style channel is
    // the MuLan text embedding of this sentence — so if they are left out of the
    // prose, a genre/mood pick steers nothing about the sound. Fold them in as a
    // leading clause (skipping any token the creator already named) so the model
    // actually receives that steering. Normalized labels are used so a bad input
    // can't inject garbage into the prompt.
    const { genre: normGenre, mood: normMood } = releaseMetadata({ genre, mood });
    const safeStyle = enrichSkyeStyle(rawStyle, normGenre, normMood);

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
        duration: safeDuration,
        seed: safeSeed,
        cfgStrength: cfgOverride,
        sampleSteps: stepsOverride,
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
        lyrics: safeLyrics,
        duration: safeDuration, seed: safeSeed,
        title: title || '', credit_cost: cost,
        engine: 'hf_space', model: 'DiffRhythm 2 (Skye)',
        // Release metadata — not a render parameter. Normalized at submit so the
        // library and every distribution channel read one already-valid value.
        ...releaseMetadata({ genre, mood }),
        // Recorded so a sweep take is reproducible; absent = calibrated defaults.
        ...(cfgOverride !== undefined ? { cfg_strength: cfgOverride } : {}),
        ...(stepsOverride !== undefined ? { sample_steps: stepsOverride } : {}),
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