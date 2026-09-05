import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { createPkceChallenge, buildAuthorizeUrl, findCredential } from '../../shared/audiusOAuth.ts';

/**
 * Begins the Audius consent flow for the signed-in creator.
 *
 * The PKCE verifier and CSRF state are stored on the creator's credential row and
 * NOT handed to the browser: holding them server-side is what allows the token
 * exchange to happen in audiusOAuthCallback, so the tokens never touch a client.
 *
 * Payload: { scope? }  →  { authorize_url, redirect_uri }
 */

// Must match a redirect URI registered on the Audius developer app. Fixed rather
// than derived from the request origin: Audius rejects any unregistered URI, and an
// origin-derived value would silently break the moment the app is opened elsewhere.
const REDIRECT_URI = 'https://base-station.base44.app/audius-callback';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('AUDIUS_API_KEY');
    if (!apiKey) return Response.json({ error: 'AUDIUS_API_KEY is not configured' }, { status: 500 });

    let scope = 'write';
    try {
      const body = await req.json();
      if (body?.scope === 'read') scope = 'read';
    } catch (_) { /* default scope */ }

    const { codeVerifier, codeChallenge, state } = await createPkceChallenge();

    const pending = {
      user_id: user.id,
      user_email: user.email,
      scope,
      status: 'pending',
      pending_state: state,
      pending_code_verifier: codeVerifier,
      pending_started_at: new Date().toISOString(),
      error_message: '',
    };

    // One row per creator: a second consent attempt replaces the in-flight verifier
    // rather than accumulating rows that could each satisfy a callback.
    const existing = await findCredential(base44, user.id);
    if (existing) {
      await base44.asServiceRole.entities.AudiusCredential.update(existing.id, pending);
    } else {
      await base44.asServiceRole.entities.AudiusCredential.create(pending);
    }

    const authorizeUrl = buildAuthorizeUrl({
      apiKey,
      redirectUri: REDIRECT_URI,
      state,
      codeChallenge,
      scope,
    });

    return Response.json({ data: { authorize_url: authorizeUrl, redirect_uri: REDIRECT_URI } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}