import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5.8 — Reports whether server-side Streamr is configured.
 * The browser uses this to gate the "streamr" audio mode option without
 * needing a session/performer context.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const available = !!Deno.env.get('STREAMR_PRIVATE_KEY');
    return Response.json({ available });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});