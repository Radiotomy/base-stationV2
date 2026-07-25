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

// Deployment name on Replicate (private models are invoked via the
// deployments endpoint, not the model endpoint). Defaults to the same
// name as the model. Override with BASE_MARK_V2_DEPLOYMENT env if needed.
export function v2Deployment() {
  const model = v2Model();
  const override = Deno.env.get('BASE_MARK_V2_DEPLOYMENT');
  if (override) return override;
  // model is "owner/name" — deployment defaults to the "name" part.
  return model.split('/')[1] || model;
}

// Run a prediction on the private V2 model via its Replicate deployment.
// Blocks up to ~60s via Prefer:wait, then polls (cold starts on GPU models
// can take a while). Returns the output.
export async function runV2(input, { timeoutMs = 300000 } = {}) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const owner = v2Model().split('/')[0];
  const deployment = v2Deployment();
  const r = await fetch(`https://api.replicate.com/v1/deployments/${owner}/${deployment}/predictions`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'wait=60' },
    body: JSON.stringify({ input }),
  });
  let data = await r.json();
  if (!r.ok) {
    const msg = data?.detail || data?.error || JSON.stringify(data);
    throw new Error(`Replicate deployment error (${r.status}): ${msg}`);
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