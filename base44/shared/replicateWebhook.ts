// Shared helper — builds the webhook URL Replicate will POST to when a
// generation prediction (BASE-Harmonix, BASE SoundForge) settles. Reuses the
// SAME deployed endpoint and secret already configured for BASE Mark V2
// (REPLICATE_WEBHOOK_URL / REPLICATE_WEBHOOK_SECRET) — replicateV2Webhook
// routes generation-job predictions and V2 embed predictions to their
// respective finalizers, so no second webhook URL/secret is needed.
//
// Returns null when either env is missing — callers then simply omit the
// `webhook` field and fall back to the existing interactive + safety-net
// polling path. No silent breakage either way.
export function generationWebhookUrl() {
  const base = Deno.env.get('REPLICATE_WEBHOOK_URL');
  const secret = Deno.env.get('REPLICATE_WEBHOOK_SECRET');
  if (!base || !secret) return null;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}sig=${secret}`;
}