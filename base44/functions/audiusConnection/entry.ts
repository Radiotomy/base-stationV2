import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { findCredential, toConnectionStatus, revokeRefreshToken } from '../../shared/audiusOAuth.ts';

/**
 * Reads or tears down the signed-in creator's Audius grant.
 *
 * Payload: { action: 'status' | 'disconnect' }
 *
 * Returns a connection status only. Tokens are structurally excluded by
 * toConnectionStatus, so this endpoint cannot leak them.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action = 'status' } = await req.json().catch(() => ({}));
    const credential = await findCredential(base44, user.id);

    if (action === 'status') {
      return Response.json({ data: toConnectionStatus(credential) });
    }

    if (action === 'disconnect') {
      if (!credential) return Response.json({ data: toConnectionStatus(null) });

      const apiKey = Deno.env.get('AUDIUS_API_KEY');
      if (credential.refresh_token && apiKey) {
        await revokeRefreshToken({ apiKey, refreshToken: credential.refresh_token });
      }

      // Tokens are cleared but the row is kept: the creator's publish history refers
      // to this account, and a vanished row is indistinguishable from never connecting.
      await base44.asServiceRole.entities.AudiusCredential.update(credential.id, {
        access_token: '',
        refresh_token: '',
        status: 'disconnected',
        pending_state: '',
        pending_code_verifier: '',
        error_message: '',
      });

      return Response.json({ data: toConnectionStatus({ status: 'disconnected' }) });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}