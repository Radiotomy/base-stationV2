// BASE SoundForge — our tiered loop/sample/SFX engine built on Stable Audio Open 1.0
// (Stability AI's open-weights audio diffusion model), hosted on Replicate
// (stackadoc/stable-audio-open-1.0).
//
// ⚠️ LICENSE (verified 2026-08-02): Stability AI Community License — NOT a
// permissive open-source licence. Commercial use is free only while total annual
// revenue stays under USD $1M (any source, not just this model), requires
// registration with Stability AI, and the grant is REVOCABLE. Above $1M a paid
// Enterprise Licence is required. Derivative works / fine-tunes inherit the same
// terms, so do not train on these weights. Replacing this base model with an
// Apache-2.0 alternative is tracked as a pre-scale task.
//
// We load the open weights via Replicate,
// wrap them in our own prompt engineering, presets, and product identity so the
// Loops & Samples Studio ships under the BASE Station brand rather than a raw
// pass-through of a third-party tool — mirroring the BASE-Harmonix approach.

export const SOUNDFORGE_MODEL = 'stackadoc/stable-audio-open-1.0';
export const SOUNDFORGE_VERSION = '9aff84a639f96d0f7e6081cdea002d15133d0043727f849c40abdd166b7c75a8';

export const SOUNDFORGE_CREDIT_COST = 2;
export const SOUNDFORGE_MAX_DURATION = 30;

import { generationWebhookUrl } from './replicateWebhook.ts';

async function postPrediction(input, prefer) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const body = { version: SOUNDFORGE_VERSION, input };
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
    throw new Error(`BASE SoundForge (Replicate) error (${res.status}): ${msg}`);
  }
  return data;
}

// Fire a prediction and wait up to 55s synchronously — Stable Audio Open typically
// settles in a few seconds for short loops/samples. Callers (pollGenerationJob)
// poll the rest of the way if it doesn't settle in time.
export async function startSoundForge(input) {
  return await postPrediction(input, 'wait=55');
}

export async function getSoundForgePrediction(id) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.detail || data?.error || `Replicate poll error (${r.status})`);
  return data;
}

export function extractSoundForgeAudioUrl(output) {
  if (!output) return null;
  if (Array.isArray(output)) return output[0] || null;
  if (typeof output === 'string') return output;
  return output.url || null;
}