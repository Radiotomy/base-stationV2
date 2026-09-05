import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  exchangeCodeForTokens,
  fetchAudiusMe,
  resolveEncodedUserId,
  findCredential,
  isPendingExpired,
  toConnectionStatus,
} from '../../shared/audiusOAuth.ts';

/**
 * Completes the Audius consent flow: exchanges the authorization code for tokens
 * and records the grant. Returns only a connection status — never a token.
 *
 * Payload: { code, state }  →  { connected, handle, name, ... }
 */

// Must be byte-identical to the value sent in audiusOAuthStart: Audius re-validates
// it during the exchange, so a mismatch fails the token request.
const REDIRECT_URI = 'https://base-station.base44.app/audius-callback';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, state } = await req.json();
    if (!code || !state) return Response.json({ error: 'code and state are required' }, { status: 400 });

    const apiKey = Deno.env.get('AUDIUS_API_KEY');
    if (!apiKey) return Response.json({ error: 'AUDIUS_API_KEY is not configured' }, { status: 500 });

    const credential = await findCredential(base44, user.id);
    if (!credential || !credential.pending_code_verifier) {
      return Response.json({ error: 'No Audius authorization is in progress — start again.' }, { status: 400 });
    }

    // The state check is the CSRF boundary: without it an authorization code obtained
    // by someone else could be planted on this creator's account.
    if (credential.pending_state !== state) {
      await base44.asServiceRole.entities.AudiusCredential.update(credential.id, {
        status: 'disconnected',
        pending_state: '',
        pending_code_verifier: '',
        error_message: 'Authorization could not be verified (state mismatch). Please try again.',
      });
      return Response.json({ error: 'Authorization could not be verified. Please try again.' }, { status: 400 });
    }

    if (isPendingExpired(credential.pending_started_at)) {
      return Response.json({ error: 'This authorization expired — please connect again.' }, { status: 400 });
    }

    const tokens = await exchangeCodeForTokens({
      apiKey,
      code,
      codeVerifier: credential.pending_code_verifier,
      redirectUri: REDIRECT_URI,
    });

    const me = await fetchAudiusMe(tokens.accessToken);
    // The encoded id is what the upload SDK needs; /v1/me only reports the numeric one.
    const encodedId = await resolveEncodedUserId({ apiKey, handle: me.handle });

    const nowIso = new Date().toISOString();
    await base44.asServiceRole.entities.AudiusCredential.update(credential.id, {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      audius_user_id: encodedId,
      audius_numeric_id: me.userId,
      handle: me.handle,
      name: me.name || me.handle,
      verified: !!me.verified,
      profile_picture_url: me.profilePicture?.['480x480'] || me.profilePicture?.['150x150'] || '',
      status: 'connected',
      connected_at: nowIso,
      refreshed_at: nowIso,
      // The verifier is single-use: clearing it stops the same code being replayed.
      pending_state: '',
      pending_code_verifier: '',
      error_message: '',
    });

    // Populates the public profile snapshot (followers, track counts) the rest of the
    // app already reads. Non-fatal: the grant itself is what publishing depends on.
    try {
      await base44.functions.invoke('syncAudiusIdentity', { audiusUserId: encodedId });
    } catch (_) { /* profile snapshot can be refreshed later */ }

    const updated = await findCredential(base44, user.id);
    return Response.json({ data: toConnectionStatus(updated) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}