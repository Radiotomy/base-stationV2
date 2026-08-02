// BASE-Harmonix — our tiered product line built on ACE-Step v1.5, hosted on
// Replicate (fishaudio/ace-step-1.5).
//
// LICENSE (verified 2026-08-02): Apache 2.0 — see github.com/ace-step/ACE-Step.
// Irrevocable, no revenue cap, no registration required. Commercial use,
// modification, derivative works and fine-tunes (LoRA) are all permitted, so
// this model is safe to fork, wrap, and train on top of.
// Generates full songs — instrumental AND vocal — from a text prompt + optional lyrics.
//
// Three tiers, same base model, different inference budgets / feature set:
//   Micro  — fast draft/preview generation (fewest steps, shortest duration)
//   Pro    — full studio-quality generation (core pipeline)
//   Vault  — Pro quality + auto BASE Mark neural watermark + DDEX provenance (COS-verified)

export const HARMONIX_MODEL = 'fishaudio/ace-step-1.5';
export const HARMONIX_VERSION = '74e3a7d383b18815e277de5223f5fe9d53d38832de15aa567fe729fa129d0d85';

export const HARMONIX_TIERS = {
  micro: {
    key: 'micro',
    name: 'BASE-Harmonix Micro',
    tagline: 'Lite / Fast',
    description: 'Quick draft generation & real-time previewing',
    inference_steps: 4,
    max_duration: 30,
    credit_cost: 3,
  },
  pro: {
    key: 'pro',
    name: 'BASE-Harmonix Pro',
    tagline: 'Core Model · v1',
    description: 'Full-track generation for the standard pipeline',
    inference_steps: 27,
    max_duration: 120,
    credit_cost: 10,
  },
  vault: {
    key: 'vault',
    name: 'BASE-Harmonix Vault',
    tagline: 'Watermarked / Verified · COS',
    description: 'Pro quality, embedded with acoustic watermarking & DDEX metadata',
    inference_steps: 60,
    max_duration: 180,
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