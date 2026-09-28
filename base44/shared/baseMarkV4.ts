// TRADE SECRET — BASE Station proprietary and confidential. Server-side only.
// Do not copy, publish, redistribute or import into client code.
// BASE Mark V4 — Speed Layer (audiowmark on Replicate).
//
// The layer that targets re-timed playback, which V1, V2 and V3 all measurably
// fail. See src/docs/basemark-v4-speed/predict.py for the full rationale and
// the measured failure data that motivated it.
//
// Two things make this materially simpler than V3 on the app side:
//
//   1. FULL 32-BIT PAYLOAD. audiowmark carries 128 bits, so our registry
//      payload fits whole. There is no slot table, no pointer indirection and
//      no 65,536-asset ceiling — the three worst constraints of V3 simply do
//      not exist here. A V4 recovery resolves through the SAME registry lookup
//      as V1 and V2.
//   2. CPU ONLY. No warm pool, no cold-start routing, no idle GPU burn. That is
//      why there is no deployment endpoint below: the model endpoint is fine.

export const BASE_MARK_V4_VERSION = '4.0';

// PHASE 6: the message layout lives in baseMarkV4Message.ts, where it became a
// keyed per-copy format. Re-exported so existing importers keep working — but
// both helpers are now ASYNC, because the validity tag is a real HMAC.
export {
  packV4Message,
  unpackV4Message,
  newCopyId,
  V4_MESSAGE_HEX_CHARS,
  V4_MESSAGE_VERSION,
  V4_BEARER_COPY_ID,
} from './baseMarkV4Message.ts';
import { packV4Message, V4_MESSAGE_HEX_CHARS, V4_BEARER_COPY_ID } from './baseMarkV4Message.ts';

// Same defensive check as V3: a stored model value without a slash is a
// misconfigured secret (we have literally had the secret NAME saved as its
// value), and Replicate answers that with a confusing 404 rather than an
// obvious config error.
export function v4Model() {
  const raw = (Deno.env.get('BASE_MARK_V4_MODEL') || '').trim();
  return raw.includes('/') ? raw : 'speedwolf2000/basemark-speed';
}

export function v4Version() {
  return Deno.env.get('BASE_MARK_V4_VERSION') || null;
}

// The audiowmark algorithm is public GPLv3 source. The KEY is therefore the
// only thing that stops a third party from locating, reading or forging our
// marks, so a missing key is a hard failure rather than a silent fallback to an
// unkeyed (publicly readable) mark.
export function v4Key() {
  const key = (Deno.env.get('BASE_MARK_V4_KEY') || '').trim();
  if (!key) throw new Error('BASE_MARK_V4_KEY is not set — refusing to write an unkeyed, publicly readable mark');
  return key;
}

// ── Replicate plumbing ─────────────────────────────────────────────────────
function endpoints(version) {
  const [owner = '', name = ''] = v4Model().split('/');
  const out = [];
  if (version) out.push({ url: 'https://api.replicate.com/v1/predictions', kind: 'generic' });
  out.push({ url: `https://api.replicate.com/v1/models/${owner}/${name}/predictions`, kind: 'models' });
  return out;
}

async function postPrediction(input, prefer, version = v4Version(), webhook = null) {
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
  throw new Error(`V4 prediction could not be created: ${fallback || 'no endpoint available'}`);
}

export async function getV4Prediction(id) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`V4 poll error (${r.status}): ${data?.detail || data?.error || ''}`);
  return data;
}

export async function startV4(input, version, webhook = null) {
  return await postPrediction(input, undefined, version || v4Version(), webhook);
}

// Blocking helper. Unlike V3 this is genuinely usable on a request path for
// short audio, because there is no GPU cold start to absorb — but a full master
// with speed detection is still slow, so callers with real-world inputs should
// prefer startV4 + polling.
export async function runV4(input, { timeoutMs = 300000 } = {}) {
  let data = await postPrediction(input, 'wait=60');
  const headers = { 'Authorization': `Bearer ${Deno.env.get('REPLICATE_API_TOKEN')}` };
  const started = Date.now();
  while (data.status === 'starting' || data.status === 'processing') {
    if (Date.now() - started > timeoutMs) throw new Error('Speed Layer timed out.');
    await new Promise((res) => setTimeout(res, 2500));
    const p = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, { headers });
    data = await p.json();
  }
  if (data.status !== 'succeeded') throw new Error(`Speed Layer failed: ${data.error || data.status}`);
  return data.output;
}

// `copyId` is what makes a recovery traceable to ONE delivered file rather than
// only to the asset (Phase 6). Omitting it embeds the bearer sentinel, which is
// a deliberately weaker claim and is reported as such by unpackV4Message.
export async function encodeV4(audioUrl, payloadHex, copyId = V4_BEARER_COPY_ID) {
  return await runV4({
    audio: audioUrl,
    mode: 'encode',
    payload_hex: await packV4Message(payloadHex, copyId),
    key_hex: v4Key(),
  });
}

// `detectSpeed` is opt-in for a reason: the speed search costs substantially
// more CPU and memory than a plain scan. The intended production flow is a
// cheap scan first, escalating to the search only on a miss — which is also
// exactly how the deep scan is gated today.
export async function decodeV4(audioUrl, { detectSpeed = false, patient = false } = {}) {
  return await runV4({
    audio: audioUrl,
    mode: 'decode',
    // Ignored on decode, but sent anyway: the deployed schema marks payload_hex
    // required (Cog dropped its default), so omitting it is a 422 rather than a
    // scan. Harmless to keep even once the container is rebuilt.
    payload_hex: '0'.repeat(V4_MESSAGE_HEX_CHARS),
    key_hex: v4Key(),
    detect_speed: detectSpeed,
    patient,
  });
}