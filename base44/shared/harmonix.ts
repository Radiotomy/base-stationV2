// BASE-Harmonix — our tiered product line, now backed by the Coda engine
// (ACE-Step 1.5 XL Turbo, 4B DiT) self-hosted on our Hugging Face Space.
// See base44/shared/codaEngine.ts for the engine client. The Replicate
// deployment (fishaudio/ace-step-1.5) is RETIRED — the constants and poll
// helpers below survive only so legacy in-flight jobs can still finalize.
//
// LICENSE (verified 2026-08-02): Apache 2.0 — see github.com/ace-step/ACE-Step.
// Irrevocable, no revenue cap, no registration required. Commercial use,
// modification, derivative works and fine-tunes (LoRA) are all permitted.
// Generates full songs — instrumental AND vocal — from style tags + optional lyrics.
//
// Three tiers, same engine (inference is FIXED at 8 steps / CFG 1.0 by XL
// Turbo), different duration ceilings / feature set:
//   Micro  — fast draft/preview generation (shortest duration)
//   Pro    — full-track generation (core pipeline)
//   Vault  — Pro + auto BASE Mark neural watermark + DDEX provenance (COS-verified)

export const HARMONIX_MODEL = 'fishaudio/ace-step-1.5';
export const HARMONIX_VERSION = '74e3a7d383b18815e277de5223f5fe9d53d38832de15aa567fe729fa129d0d85';

export const HARMONIX_TIERS = {
  micro: {
    key: 'micro',
    name: 'BASE-Harmonix Micro',
    tagline: 'Lite / Fast',
    description: 'Quick draft generation & real-time previewing',
    inference_steps: 4,
    max_duration: 60,
    credit_cost: 3,
  },
  pro: {
    key: 'pro',
    name: 'BASE-Harmonix Pro',
    tagline: 'Core Model · v1',
    description: 'Full-track generation for the standard pipeline',
    // ACE-Step's own guidance puts the base/SFT sweet spot at 32-100 steps. 27
    // sat just under it, which is exactly where the instrumental bed wavers
    // around the vocal instead of committing to a groove.
    inference_steps: 36,
    // ACE-Step 1.5 XL Turbo generates up to 600s (10 min) in one pass. Typical
    // full tracks land at 240-360s; the creator sets the length per generation.
    max_duration: 600,
    credit_cost: 10,
  },
  vault: {
    key: 'vault',
    name: 'BASE-Harmonix Vault',
    tagline: 'Watermarked / Verified · COS',
    description: 'Pro quality, embedded with acoustic watermarking & DDEX metadata',
    inference_steps: 60,
    max_duration: 600,
    credit_cost: 15,
  },
};

export function resolveTier(tier) {
  return HARMONIX_TIERS[tier] || HARMONIX_TIERS.pro;
}

import { generationWebhookUrl } from './replicateWebhook.ts';

async function postPrediction(input, prefer) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const body = { version: HARMONIX_VERSION, input };
  const webhook = generationWebhookUrl();
  if (webhook) { body.webhook = webhook; body.webhook_events_filter = ['completed']; }
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.detail || data?.error || JSON.stringify(data);
    throw new Error(`BASE-Harmonix (Replicate) error (${res.status}): ${msg}`);
  }
  return data;
}

// Fire a prediction and wait up to 55s synchronously — ACE-Step typically settles
// in 10-30s on Replicate's GPUs. Returns the prediction either already-settled or
// still processing; callers (pollGenerationJob) poll the rest of the way.
export async function startHarmonix(input) {
  return await postPrediction(input, 'wait=55');
}

export async function getHarmonixPrediction(id) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.detail || data?.error || `Replicate poll error (${r.status})`);
  return data;
}

// Normalize the model's `output` field into a single playable audio URL.
export function extractAudioUrl(output) {
  if (!output) return null;
  if (Array.isArray(output)) return output[0] || null;
  if (typeof output === 'string') return output;
  return output.url || null;
}