import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Hands the browser the values it needs to run the Audius OAuth PKCE flow.
 *
 * Only the API KEY is returned. Audius issues three credentials and they are not
 * interchangeable: the api key is a public app identifier (their own web upload
 * example ships it as a VITE_ env var), while AUDIUS_API_SECRET is a write
 * credential that must never leave the server. Returning the key alone is what
 * makes a browser-side upload safe — PKCE replaces the secret with a per-request
 * challenge, so no long-lived credential is exposed.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('AUDIUS_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'AUDIUS_API_KEY is not configured' }, { status: 500 });
    }

    return Response.json({ data: { api_key: apiKey } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});