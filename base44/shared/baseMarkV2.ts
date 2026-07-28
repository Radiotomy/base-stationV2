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

// Candidate prediction endpoints in preference order, each tagged with a
// `kind` so buildBody knows whether to attach a `version` digest pin:
//   deployments — POST /v1/deployments/{owner}/{name}/predictions (no version;
//                runs the deployment's dashboard-pinned release). Primary path
//                when BASE_MARK_V2_DEPLOYMENT is a real deployment name.
//   generic     — POST /v1/predictions with {version, input}. The ONLY endpoint
//                that accepts an explicit image digest, so it is the fallback
//                whenever BASE_MARK_V2_VERSION is set. Also bypasses the
//                "needs an official version" 404 the model endpoint returns on
//                a freshly-pushed private model.
//   models      — POST /v1/models/{owner}/{name}/predictions (no version; uses
//                latest/official version). Always available as a last resort.
// Callers try each in order and fall through on 404 to the next.
export function v2PostUrls() {
  const [owner = '', name = ''] = v2Model().split('/');
  const out = [];
  const raw = v2Deployment();
  if (raw) {
    // The secret may be stored as "base-mark-v2" (bare name) or as the full
    // "speedwolf2000/base-mark-v2" identifier. Normalize so we never produce a
    // double-owner URL like /deployments/speedwolf2000/speedwolf2000/base-mark-v2.
    const trimmed = raw.trim();
    const [depOwner, depName] = trimmed.includes('/')
      ? trimmed.split('/')
      : [owner, trimmed];
    out.push({ url: `https://api.replicate.com/v1/deployments/${depOwner}/${depName}/predictions`, kind: 'deployments' });
  }
  const version = v2Version();
  if (version) out.push({ url: 'https://api.replicate.com/v1/predictions', kind: 'generic' });
  out.push({ url: `https://api.replicate.com/v1/models/${owner}/${name}/predictions`, kind: 'models' });
  return out;
}

// Optional deterministic version pin (image digest). When set, predictions
// routed through the generic /v1/predictions endpoint are pinned to this exact
// digest so watermarking stays byte-stable across pushes to :latest. The
// deployments endpoint ignores it (uses the dashboard-pinned release) and the
// models endpoint rejects it, so it only takes effect on the generic path.
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

// Build a prediction POST body.
//   - deployments: runs the dashboard-pinned release; REJECTS a `version`
//     field (422 "Additional property version is not allowed"), so never send one.
//   - generic (/v1/predictions): the ONLY endpoint that accepts an explicit
//     image digest. Attaches `version` = BASE_MARK_V2_VERSION when set, pinning
//     every prediction to that exact digest so a later `cog push` to :latest
//     cannot silently shift neural-watermark behavior.
//   - models: uses latest/official version; sends no `version` (the endpoint
//     rejects it the same way deployments does).
function buildBody(input, kind) {
  const body = { input };
  if (kind === 'generic') {
    const version = v2Version();
    if (version) body.version = version;
  }
  const webhook = v2WebhookUrl();
  if (webhook) {
    body.webhook = webhook;
    body.webhook_events_filter = ['completed'];
  }
  return body;
}

// POST a prediction, trying endpoints in preference order (deployments →
// generic → models) and falling through on 404 to the next. A 404 means the
// resource (deployment / official version) does not exist; any other error is
// surfaced immediately so a real failure isn't masked by a silent fallback.
async function postPrediction(input, prefer) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const endpoints = v2PostUrls();
  let fallback;
  for (let i = 0; i < endpoints.length; i++) {
    const { url, kind } = endpoints[i];
    const r = await fetch(url, {
      method: 'POST',
      headers: prefer ? { ...headers, Prefer: prefer } : headers,
      body: JSON.stringify(buildBody(input, kind)),
    });
    if (r.status === 404 && i < endpoints.length - 1) { fallback = await r.text().catch(() => ''); continue; }
    const data = await r.json();
    if (!r.ok) {
      const msg = data?.detail || data?.error || JSON.stringify(data);
      throw new Error(`Replicate error (${r.status}): ${msg}`);
    }
    return data;
  }
  throw new Error(`Replicate prediction could not be created: ${fallback || 'no endpoint available'}`);
}

// Run a prediction on the private V2 model. Blocks up to ~60s via Prefer:wait,
// then polls (cold starts on GPU models can take a while). Returns the output.
export async function runV2(input, { timeoutMs = 300000 } = {}) {
  let data = await postPrediction(input, 'wait=60');
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  const headers = { 'Authorization': `Bearer ${token}` };

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

// Run a V2 decode. `phaseShift` maps to SilentCipher's `phase_shift_decoding`,
// which the upstream model documents as what makes the decoder robust to audio
// CROPS — the exact case for user-submitted snippets. It is significantly slower,
// so callers opt in only where crop robustness matters.
// Older builds of the container may not expose the input, so a rejected request
// is retried once without the flag rather than losing V2 detection entirely.
export async function decodeV2(audio, { phaseShift = false } = {}) {
  if (!phaseShift) return await runV2({ action: 'decode', audio });
  try {
    return await runV2({ action: 'decode', audio, phase_shift_decoding: true });
  } catch (e) {
    if (!/422|Additional property|not allowed|unexpected keyword/i.test(e.message || '')) throw e;
    return await runV2({ action: 'decode', audio });
  }
}

// Fire a prediction WITHOUT blocking. Returns the full prediction object
// { id, status, urls, ... } — caller polls getV2Prediction(id) until done.
// Use this for the async embed flow so cold starts don't block the request.
export async function startV2(input) {
  return await postPrediction(input);
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