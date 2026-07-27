import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

/**
 * Phase 6 — Reports whether server-side Streamr (live audio transport) is
 * configured. The browser uses this to decide whether to offer the "streamr"
 * audio mode without needing session/performer context.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const available = !!secrets.get('STREAMR_PRIVATE_KEY');
    return Response.json({ available });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}