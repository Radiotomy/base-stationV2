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

// Run a prediction on the private V2 model. Blocks up to ~60s via Prefer:wait,
// then polls (cold starts on GPU models can take a while). Returns the output.
export async function runV2(input, { timeoutMs = 120000 } = {}) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const r = await fetch(`https://api.replicate.com/v1/models/${v2Model()}/predictions`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'wait=60' },
    body: JSON.stringify({ input }),
  });
  let data = await r.json();
  if (!r.ok) {
    const msg = data?.detail || data?.error || JSON.stringify(data);
    if (r.status === 404) {
      throw new Error(`BASE Mark V2 model "${v2Model()}" is not published on Replicate yet. Push it with Cog first.`);
    }
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