// generateMusicHarmonix — BASE-Harmonix generation on the Coda engine (ACE-Step
// 1.5 XL Turbo, 4B DiT) hosted on our Hugging Face Space. Replaces the retired
// Replicate deployment.
//
// Async submit-and-poll: this function checks credits, submits to Coda's
// POST /generate/audio and returns a GenerationJob id immediately. The studio's
// existing useJobPolling → pollGenerationJob → finalizeJob loop polls Coda's
// /status/{job_id}, persists the WAV, deducts credits (stamped in
// input_data.credit_cost), auto-saves to the library and — because the saved
// asset carries no base_mark — hands the WAV to the BASE Mark forensic cascade.
//
// Hyperparameters are FIXED by the XL Turbo engine (steps=8, CFG=1.0) and only
// recorded here for provenance. Groove anchors (bpm/key/time signature) fold
// into the tags channel, which is how ACE-Step reads them.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveTier } from '../../shared/harmonix.ts';
import { submitCodaGeneration, CODA_MODEL_VERSION, CODA_FIXED_PARAMS } from '../../shared/codaEngine.ts';

async function checkCreditBalance(base44, user, requiredCredits) {
  const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  const record = credits[0];
  const balance = record?.balance ?? 0;
  return { ok: balance >= requiredCredits, balance };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      tier = 'pro', prompt, lyrics, duration = 60, title,
      bpm, key_scale, time_signature, seed,
    } = await req.json();
    if (!prompt || !prompt.trim()) return Response.json({ error: 'prompt is required' }, { status: 400 });

    const tierConfig = resolveTier(tier);
    const cost = tierConfig.credit_cost;

    const { ok: hasCredits, balance } = await checkCreditBalance(base44, user, cost);
    if (!hasCredits) {
      return Response.json({
        error: 'Insufficient credits', required: cost, balance,
        message: `This generation costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const safeDuration = Math.min(Math.max(Number(duration) || 60, 5), tierConfig.max_duration);
    const hasLyrics = !!(lyrics && lyrics.trim());

    // Groove anchors fold into the tags channel — Coda's payload has no separate
    // bpm/key/time-signature parameters, but ACE-Step reads them from tags.
    const numBpm = Number(bpm);
    const safeBpm = Number.isFinite(numBpm) && numBpm >= 30 && numBpm <= 300 ? Math.round(numBpm) : null;
    const safeKey = key_scale && String(key_scale).trim() ? String(key_scale).trim().slice(0, 40) : '';
    const safeTimeSig = ['2', '3', '4', '6'].includes(String(time_signature)) ? String(time_signature) : '';
    const tagParts = [prompt.slice(0, 512).trim()];
    if (safeBpm) tagParts.push(`${safeBpm} bpm`);
    if (safeKey) tagParts.push(safeKey);
    if (safeTimeSig) tagParts.push(`${safeTimeSig}/4 time signature`);
    const tags = tagParts.join(', ');

    // Preserved for deterministic iteration and asset fingerprinting.
    const numSeed = Number(seed);
    const safeSeed = Number.isFinite(numSeed) && numSeed > 0 ? Math.round(numSeed) : 42;

    let submitted;
    try {
      submitted = await submitCodaGeneration({
        tags,
        // Vocal mode: lowercase [verse]/[chorus]/[bridge]/[outro] structure tags
        // (normalized client-side by aceStepLyrics.js) drive the vocal synthesis.
        // Instrumental mode: exactly '[instrumental]' dedicates the full DiT
        // budget to the instrumental bed.
        lyrics: hasLyrics ? lyrics.slice(0, 4000) : '[instrumental]',
        maxMs: safeDuration * 1000,
        seed: safeSeed,
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }

    const startedAt = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'harmonix',
      status: 'processing',
      ai_label: 'ai_generated',
      input_data: {
        tier, tier_name: tierConfig.name,
        prompt, lyrics: lyrics || '', duration: safeDuration,
        title: title || '', credit_cost: cost,
        // Engine stamp — this is what routes the job to Coda in finalizeJob.
        // Legacy rows without it keep the old Replicate poll path.
        engine: 'coda_hf', model: CODA_MODEL_VERSION,
        tags,
        bpm: safeBpm, key_scale: safeKey, time_signature: safeTimeSig || 'auto',
        seed: safeSeed,
        // Fixed by the XL Turbo engine — recorded for provenance only.
        ...CODA_FIXED_PARAMS,
      },
      provider_job_id: submitted.jobId,
      started_at: startedAt,
    });

    return Response.json({
      job_id: job.id,
      status: 'processing',
      tier, tier_name: tierConfig.name,
      // Returned so the client records the engine that actually rendered the
      // track rather than assuming one.
      engine: 'coda_hf', model: CODA_MODEL_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});