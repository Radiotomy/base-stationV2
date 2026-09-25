// audiotoolIngestState — hands an Audiotool project to the BASE Nexus Bridge,
// which pulls the session as binary protobuf and parses it natively. The
// creator's own Audiotool access token is forwarded only to the bridge (which
// uses it for a single GetEntities call) and is never stored.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { secrets } from 'base44:runtime';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project, access_token } = await req.json();
    if (!project || !access_token) {
      return Response.json({ error: 'project and access_token are required' }, { status: 400 });
    }

    const bridge = (secrets.get('AUDIOTOOL_BRIDGE_URL') || '').replace(/\/+$/, '');
    if (!bridge) return Response.json({ error: 'The BASE Nexus Bridge engine is not connected yet' }, { status: 503 });

    const res = await fetch(`${bridge}/audiotool/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secrets.get('HF_TOKEN')}`,
      },
      body: JSON.stringify({ project: String(project), access_token: String(access_token) }),
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 300);
      try { detail = JSON.parse(text).detail || detail; } catch (_) { /* keep raw */ }
      return Response.json({ error: `Engine error (${res.status}): ${detail}` }, { status: 502 });
    }
    return new Response(text, { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}