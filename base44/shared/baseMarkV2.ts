// BASE Mark V2 — neural watermark layer (SilentCipher engine on Replicate).
// The 40-bit neural message carries: 1 magic byte (0xB5) + the same 32-bit
// payload used by BASE Mark V1, so both marks resolve to the same registry
// record on UserAsset.metadata.

export const BASE_MARK_V2_VERSION = '2.0';
export const V2_MAGIC = 0xb5;

// Private Replicate model name — overridable without a code change.
export function v2Model() {
  return Deno.env.get('BASE_MARK_V2_MODEL') || 'speedwolf2000/base-mark-v2';
}

// 8-char hex payload -> [magic, b3, b2, b1, b0] (five ints 0-255)
export function packMessage(payloadHex) {
  const v = parseInt(payloadHex, 16) >>> 0;
  return [V2_MAGIC, (v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}

// [magic, b3, b2, b1, b0] -> { valid, payload_hex }
export function unpackMessage(message) {
  if (!Array.isArray(message) || message.length !== 5 || message[0] !== V2_MAGIC) {
    return { valid: false, payload_hex: null };
  }
  const v = ((message[1] << 24) | (message[2] << 16) | (message[3] << 8) | message[4]) >>> 0;
  return { valid: true, payload_hex: v.toString(16).padStart(8, '0') };
}

// Deployment name on Replicate. Only used when BASE_MARK_V2_DEPLOYMENT is
// explicitly set — in which case predictions go through the deployments
// endpoint (Replicate's productionized load-balanced path). When unset,
// predictions go through the model endpoint, which works as soon as a
// version is pushed to r8.im/{owner}/{name}:latest — no separate
// deployment object is required.
export function v2Deployment() {
  return Deno.env.get('BASE_MARK_V2_DEPLOYMENT') || null;
}

// Pick the Replicate prediction URL that matches how the model is hosted.
export function v2PredictUrl() {
  const [owner = '', name = ''] = v2Model().split('/');
  const deployment = v2Deployment();
  return deployment
    ? `https://api.replicate.com/v1/deployments/${owner}/${deployment}/predictions`
    : `https://api.replicate.com/v1/models/${owner}/${name}/predictions`;
}

// Optional deterministic version pin. When set (BASE_MARK_V2_VERSION), every
// V2 prediction is pinned to this exact image digest — watermarking stays
// byte-stable across pushes to :latest. When unset, predictions run latest.
export function v2Version() {
  return Deno.env.get('BASE_MARK_V2_VERSION') || null;
}

// Optional webhook URL Replicate will POST to when a prediction settles.
// Built from REPLICATE_WEBHOOK_URL (the deployed replicateV2Webhook function
// URL, set in the Base44 dashboard) plus the shared secret as a ?sig= query.
// Returns null when either env is missing — startV2 then leaves the predictor
// on the existing pollBaseMarkV2 polling path. No silent breakage.
export function v2WebhookUrl() {
  const base = Deno.env.get('REPLICATE_WEBHOOK_URL');
  const secret = Deno.env.get('REPLICATE_WEBHOOK_SECRET');
  if (!base || !secret) return null;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}sig=${secret}`;
}

// Build the prediction POST body shared by both startV2 (async) and runV2
// (blocking). Centralizes webhook + version wiring so callers stay simple.
function v2Body(input) {
  const body = { input };
  const version = v2Version();
  if (version) body.version = version;
  const webhook = v2WebhookUrl();
  if (webhook) {
    body.webhook = webhook;
    body.webhook_events_filter = ['completed', 'failed'];
  }
  return body;
}

// Run a prediction on the private V2 model via its Replicate deployment.
// Blocks up to ~60s via Prefer:wait, then polls (cold starts on GPU models
// can take a while). Returns the output.
export async function runV2(input, { timeoutMs = 300000 } = {}) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const r = await fetch(v2PredictUrl(), {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'wait=60' },
    body: JSON.stringify(v2Body(input)),
  });
  let data = await r.json();
  if (!r.ok) {
    const msg = data?.detail || data?.error || JSON.stringify(data);
    throw new Error(`Replicate error (${r.status}): ${msg}`);
  }

  const started = Date.now();
  while (data.status === 'starting' || data.status === 'processing') {
    if (Date.now() - started > timeoutMs) throw new Error('Neural watermark timed out — the model may be cold-starting; try again in a minute.');
    await new Promise((res) => setTimeout(res, 2500));
    const p = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, { headers });
    data = await p.json();
  }
  if (data.status !== 'succeeded') {
    throw new Error(`Neural watermark failed: ${data.error || data.status}`);
  }
  return data.output;
}

// Fire a prediction WITHOUT blocking. Returns the full prediction object
// { id, status, urls, ... } — caller polls getV2Prediction(id) until done.
// Use this for the async embed flow so cold starts don't block the request.
export async function startV2(input) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const r = await fetch(v2PredictUrl(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(v2Body(input)),
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = data?.detail || data?.error || JSON.stringify(data);
    throw new Error(`Replicate error (${r.status}): ${msg}`);
  }
  return data;
}

// Get the current status + output of a prediction by id.
// status is one of: starting | processing | succeeded | failed | canceled
export async function getV2Prediction(id) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = data?.detail || data?.error || JSON.stringify(data);
    throw new Error(`Replicate poll error (${r.status}): ${msg}`);
  }
  return data;
}