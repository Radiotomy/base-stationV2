// audiotoolConfig — returns the public Audiotool OAuth client id so the browser
// can start the PKCE flow. The client id is not a secret (it appears in the
// authorize URL), so this endpoint needs no login.

import { secrets } from 'base44:runtime';

export default async function (req: Request): Promise<Response> {
  try {
    const clientId = secrets.get('AUDIOTOOL_CLIENT_ID');
    if (!clientId) return Response.json({ error: 'Audiotool is not configured yet' }, { status: 503 });
    return Response.json({ client_id: clientId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}