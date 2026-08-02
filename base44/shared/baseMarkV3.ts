// BASE Mark V3 — Drift Layer (WavMark on Replicate).
//
// V3 carries a 16-BIT SLOT, not the 32-bit registry payload — WavMark's 32-bit
// capacity is 16 sync bits + 16 usable bits, so the registry payload does not
// fit. The slot is a POINTER: the app must map slot -> asset. V1 and V2 keep
// carrying the full 32-bit payload on the same file, so V3 adds drift coverage
// (tempo stretch, close-range re-recording) without replacing anything.
//
// Ceiling: 65,536 concurrently-marked assets. A slot-allocation strategy is
// required before wide rollout — this module deliberately does not invent one.

export const BASE_MARK_V3_VERSION = '3.0';
export const V3_SLOT_BITS = 16;

// A Replicate model is always "owner/name". A stored value without a slash is a
// misconfigured secret (it has happened: the secret name itself got saved as the
// value), and using it produces a confusing 404 from Replicate rather than an
// obvious config error — so ignore it and fall back to the known model.
export function v3Model() {
  const raw = (Deno.env.get('BASE_MARK_V3_MODEL') || '').trim();
  return raw.includes('/') ? raw : 'speedwolf2000/basemark-drift';
}

// Warm-pool deployment for the Drift Layer. Predictions are routed here FIRST
// so that a warmed instance is actually used — warming a deployment while the
// caller still hits the model endpoint would pay for idle GPU and cold-start
// anyway. If the deployment does not exist (or was never created) the request
// 404s and the endpoint list falls through to the normal model path, so this is
// safe to leave enabled permanently.
export function v3Deployment() {
  const raw = (Deno.env.get('BASE_MARK_V3_DEPLOYMENT') || '').trim();
  return raw.includes('/') ? raw : 'speedwolf2000/basemark-drift-warm';
}

// Pinned image digest. Predictions run through the generic /v1/predictions
// endpoint whenever this is set, so a later `cog push` to :latest cannot
// silently shift watermarking behavior — same discipline as V2.
export function v3Version() {
  return Deno.env.get('BASE_MARK_V3_VERSION') || null;
}

// 16-bit slot as 4 hex chars, e.g. 511 -> "01ff".
export function slotHex(slot) {
  const n = Number(slot);
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
    throw new Error('V3 slot must be an integer 0-65535');
  }
  return n.toString(16).padStart(4, '0');
}

export function slotFromHex(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]{4}$/i.test(hex)) return null;
  return parseInt(hex, 16);
}

function endpoints(version) {
  const [owner = '', name = ''] = v3Model().split('/');
  const out = [];
  // Deployment first: it is the only endpoint that can hit a warm instance.
  // It carries its own pinned version, so no version is sent with it.
  out.push({ url: `https://api.replicate.com/v1/deployments/${v3Deployment()}/predictions`, kind: 'deployment' });
  if (version) out.push({ url: 'https://api.replicate.com/v1/predictions', kind: 'generic' });
  out.push({ url: `https://api.replicate.com/v1/models/${owner}/${name}/predictions`, kind: 'models' });
  return out;
}

// `version` overrides the pinned secret — used to A/B a freshly pushed build
// against the last known-good one without editing the pin.
async function postPrediction(input, prefer, version = v3Version(), webhook = null) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const list = endpoints(version);
  let fallback;
  for (let i = 0; i < list.length; i++) {
    const { url, kind } = list[i];
    // Only the generic endpoint accepts an explicit version digest; the models
    // endpoint rejects it outright.
    const body = kind === 'generic' ? { version, input } : { input };
    // Only fire on terminal states — intermediate events would hit the
    // finalizer while the prediction is still processing.
    if (webhook) {
      body.webhook = webhook;
      body.webhook_events_filter = ['completed'];
    }
    const r = await fetch(url, {
      method: 'POST',
      headers: prefer ? { ...headers, Prefer: prefer } : headers,
      body: JSON.stringify(body),
    });
    if (r.status === 404 && i < list.length - 1) { fallback = await r.text().catch(() => ''); continue; }
    const data = await r.json();
    if (!r.ok) {
      const msg = data?.detail || data?.error || JSON.stringify(data);
      throw new Error(`Replicate error (${r.status}): ${msg}`);
    }
    return data;
  }
  throw new Error(`V3 prediction could not be created: ${fallback || 'no endpoint available'}`);
}

// Blocks up to ~60s via Prefer:wait, then polls. GPU cold starts can take
// minutes, so callers on a request path should budget for it or go async.
export async function runV3(input, { timeoutMs = 300000 } = {}) {
  let data = await postPrediction(input, 'wait=60');
  const headers = { 'Authorization': `Bearer ${Deno.env.get('REPLICATE_API_TOKEN')}` };
  const started = Date.now();
  while (data.status === 'starting' || data.status === 'processing') {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Drift Layer timed out — the model may be cold-starting; try again in a minute.');
    }
    await new Promise((res) => setTimeout(res, 2500));
    const p = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, { headers });
    data = await p.json();
  }
  if (data.status !== 'succeeded') throw new Error(`Drift Layer failed: ${data.error || data.status}`);
  return data.output;
}

// Fire a prediction WITHOUT waiting. GPU cold start plus a full-length master
// exceeds a single request's time budget, so long jobs are started here and
// polled across separate invocations.
export async function startV3(input, version, webhook = null) {
  return await postPrediction(input, undefined, version || v3Version(), webhook);
}

export async function getV3Prediction(id) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`V3 poll error (${r.status}): ${data?.detail || data?.error || ''}`);
  return data;
}

export async function encodeV3(audioUrl, slot) {
  return await runV3({ audio: audioUrl, mode: 'encode', slot_hex: slotHex(slot) });
}

export async function decodeV3(audioUrl) {
  return await runV3({ audio: audioUrl, mode: 'decode' });
}