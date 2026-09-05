/**
 * Audius OAuth 2.0 (Authorization Code + PKCE) — the single place the grant
 * lifecycle lives, so every publish path resolves a creator's token the same way.
 *
 * Audius issues no client secret for this flow: `client_id` IS the public API key,
 * and PKCE is what proves the token request came from whoever started the consent.
 * That means the code_verifier is the ONLY secret in the exchange — it is generated
 * and held server-side here (never in the browser) so the resulting tokens can be
 * stored server-side too and never reach a client.
 *
 * Three credentials exist and are not interchangeable (see audiusUpload.ts):
 * apiKey (public id), apiSecret (the APP's own write credential), and a per-user
 * bearer token minted here. A bearer token scopes a write to the creator; the app
 * secret scopes it to the platform account. Choosing wrong publishes the track
 * under the wrong artist, which is exactly what this module exists to prevent.
 */

const AUDIUS_API = 'https://api.audius.co/v1';

/** A verifier older than this is treated as an abandoned flow rather than honoured. */
const PENDING_TTL_MS = 10 * 60 * 1000;

/** Reuse a cached access token for this long before spending a refresh. */
const ACCESS_TOKEN_TTL_MS = 30 * 60 * 1000;

function base64Url(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function randomUrlSafe(byteLength = 32) {
  const array = new Uint8Array(byteLength);
  crypto.getRandomValues(array);
  return base64Url(array);
}

/** Generates the PKCE pair plus a CSRF state for one consent request. */
export async function createPkceChallenge() {
  const codeVerifier = randomUrlSafe(32);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return {
    codeVerifier,
    codeChallenge: base64Url(new Uint8Array(digest)),
    state: randomUrlSafe(16),
  };
}

/**
 * Builds the Audius consent URL.
 *
 * `response_mode: 'query'` is deliberate. Audius defaults to returning the code in
 * the URL FRAGMENT, which a server can never see — the callback page would have to
 * read it in JavaScript. Query mode keeps the code readable by the page and lets it
 * be handed straight to the backend for exchange.
 */
export function buildAuthorizeUrl({ apiKey, redirectUri, state, codeChallenge, scope = 'write' }) {
  const url = new URL(`${AUDIUS_API}/oauth/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('display', 'fullScreen');
  return url.toString();
}

async function tokenRequest(body) {
  const res = await fetch(`${AUDIUS_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error_description || json?.error || `Audius token request failed (${res.status})`);
  }
  if (!json?.access_token || !json?.refresh_token) {
    throw new Error('Audius returned an incomplete token response');
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token };
}

export async function exchangeCodeForTokens({ apiKey, code, codeVerifier, redirectUri }) {
  return await tokenRequest({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: apiKey,
    redirect_uri: redirectUri,
  });
}

export async function refreshAccessToken({ apiKey, refreshToken }) {
  return await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: apiKey,
  });
}

/**
 * Revocation errors are non-fatal per RFC 7009 — callers discard the tokens either
 * way, so a failure here must never block a creator from disconnecting.
 */
export async function revokeRefreshToken({ apiKey, refreshToken }) {
  try {
    await fetch(`${AUDIUS_API}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: refreshToken, client_id: apiKey }),
    });
  } catch (_) { /* discard locally regardless */ }
}

/** The authenticated account behind an access token. Returns the NUMERIC id only. */
export async function fetchAudiusMe(accessToken) {
  const res = await fetch(`${AUDIUS_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Could not read Audius profile (${res.status})`);
  const me = json?.data || json;
  if (!me?.handle) throw new Error('Audius did not return a handle for this account');
  return me;
}

/**
 * Resolves a handle to the ENCODED user id.
 *
 * Needed because /v1/me returns only the numeric id while the upload SDK requires
 * the encoded form. Resolving through the handle is used rather than encoding the
 * number locally so the id we store is one Audius itself issued.
 */
export async function resolveEncodedUserId({ apiKey, handle }) {
  const url = new URL(`${AUDIUS_API}/users/handle/${encodeURIComponent(String(handle).replace(/^@/, ''))}`);
  if (apiKey) url.searchParams.set('api_key', apiKey);
  else url.searchParams.set('app_name', 'BaseStation');
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.id) throw new Error(`Could not resolve Audius handle @${handle}`);
  return json.data.id;
}

export function isPendingExpired(startedAt) {
  if (!startedAt) return true;
  return Date.now() - new Date(startedAt).getTime() > PENDING_TTL_MS;
}

/** The single connected grant for a creator, or null. Service-role read. */
export async function findCredential(base44, userId) {
  const rows = await base44.asServiceRole.entities.AudiusCredential.filter({ user_id: userId });
  return rows?.[0] || null;
}

/**
 * Client-safe view of a grant. The token fields are structurally excluded here
 * rather than filtered by each caller, so no endpoint can leak them by omission.
 */
export function toConnectionStatus(credential) {
  if (!credential || credential.status !== 'connected') {
    return {
      connected: false,
      status: credential?.status || 'disconnected',
      error_message: credential?.error_message || '',
    };
  }
  return {
    connected: true,
    status: 'connected',
    scope: credential.scope || 'write',
    audius_user_id: credential.audius_user_id,
    handle: credential.handle,
    name: credential.name,
    verified: !!credential.verified,
    profile_picture_url: credential.profile_picture_url || '',
    connected_at: credential.connected_at,
    error_message: '',
  };
}

/**
 * Resolves a usable bearer token for a creator, refreshing when the cached one is
 * stale. Returns null when the creator has no write grant — callers must then fall
 * back to the app credential (or refuse), never guess an account.
 *
 * A refresh failure marks the grant 'invalid' rather than deleting it: the creator
 * needs to be told to reconnect, and a vanished row looks identical to never having
 * connected at all.
 */
export async function getUserBearerToken(base44, userId, apiKey) {
  const credential = await findCredential(base44, userId);
  if (!credential || credential.status !== 'connected') return null;
  if (credential.scope !== 'write') return null;
  if (!credential.refresh_token) return null;

  const fresh = credential.refreshed_at &&
    Date.now() - new Date(credential.refreshed_at).getTime() < ACCESS_TOKEN_TTL_MS;
  if (fresh && credential.access_token) {
    return { accessToken: credential.access_token, audiusUserId: credential.audius_user_id };
  }

  try {
    const tokens = await refreshAccessToken({ apiKey, refreshToken: credential.refresh_token });
    await base44.asServiceRole.entities.AudiusCredential.update(credential.id, {
      access_token: tokens.accessToken,
      // Audius rotates the refresh token — persisting the new one is mandatory.
      refresh_token: tokens.refreshToken,
      refreshed_at: new Date().toISOString(),
      error_message: '',
    });
    return { accessToken: tokens.accessToken, audiusUserId: credential.audius_user_id };
  } catch (error) {
    await base44.asServiceRole.entities.AudiusCredential.update(credential.id, {
      status: 'invalid',
      error_message: `Audius rejected the saved authorization — reconnect your account. (${error.message})`,
    });
    return null;
  }
}