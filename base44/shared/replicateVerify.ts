// Replicate webhook signature verification (standard-webhooks scheme).
//
// Replicate signs every webhook with an HMAC over "<id>.<timestamp>.<body>",
// sent as the webhook-id / webhook-timestamp / webhook-signature headers. The
// signing secret is account-wide and fetched once from the API.
//
// This REPLACES trust in the ?sig= query param, which was only ever a shared
// bearer in a URL — it appears in logs, proxies and referrers, and it cannot
// detect a replayed or tampered body. The HMAC can do both.
//
// Both paths are accepted during rollout: a request is trusted if the HMAC
// verifies, OR (when no signature headers are present) if the legacy ?sig=
// matches. Once every producer is confirmed signing, drop the legacy branch.

const SECRET_URL = 'https://api.replicate.com/v1/webhooks/default/secret';
const TOLERANCE_SECONDS = 5 * 60; // reject stale timestamps — replay defence

let cachedKey: string | null = null;

async function signingKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) return null;
  const r = await fetch(SECRET_URL, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const data = await r.json();
  // Format is "whsec_<base64>" — only the base64 half is the key material.
  cachedKey = typeof data?.key === 'string' ? data.key.replace(/^whsec_/, '') : null;
  return cachedKey;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a Replicate webhook. Pass the RAW body text — re-serialising parsed
 * JSON changes the bytes and the HMAC will never match.
 *
 * Returns { ok, method, reason }.
 */
export async function verifyReplicateWebhook(req: Request, rawBody: string) {
  const id = req.headers.get('webhook-id');
  const timestamp = req.headers.get('webhook-timestamp');
  const signature = req.headers.get('webhook-signature');

  // No signature headers — fall back to the legacy shared secret in the query.
  if (!id || !timestamp || !signature) {
    const legacy = Deno.env.get('REPLICATE_WEBHOOK_SECRET') || '';
    const provided = new URL(req.url).searchParams.get('sig') || '';
    if (legacy && provided && timingSafeEqual(legacy, provided)) {
      return { ok: true, method: 'legacy_query_secret' };
    }
    return { ok: false, method: 'none', reason: 'No valid signature or legacy secret' };
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return { ok: false, method: 'hmac', reason: 'Timestamp outside tolerance window' };
  }

  const key = await signingKey();
  if (!key) return { ok: false, method: 'hmac', reason: 'Signing secret unavailable' };

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(key), (c) => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // The header can carry several space-separated "v1,<sig>" entries during
  // secret rotation — any one matching is a valid signature.
  const provided = signature.split(' ').map((s) => s.split(',')[1]).filter(Boolean);
  if (provided.some((sig) => timingSafeEqual(sig, expected))) {
    return { ok: true, method: 'hmac' };
  }
  return { ok: false, method: 'hmac', reason: 'Signature mismatch' };
}