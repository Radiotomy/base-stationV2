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

// Drift Layer (V3) variant. Carries the asset id so the receiver knows which
// of the three finalizers a prediction belongs to — V3 predictions are
// otherwise indistinguishable from V2 embeds at the webhook, and handing one
// to the V2 finalizer would corrupt the cascade.
//
// The asset id is a ROUTING HINT ONLY, never an authorisation: the receiver
// re-checks that the asset's stored prediction_id matches the prediction that
// actually settled, so a forged id resolves to nothing.
export function driftWebhookUrl(assetId: string) {
  const base = generationWebhookUrl();
  if (!base || !assetId) return null;
  return `${base}&v3_asset=${encodeURIComponent(assetId)}`;
}