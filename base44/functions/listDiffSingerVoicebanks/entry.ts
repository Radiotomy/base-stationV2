import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { listVoicebanks } from '../../shared/diffSinger.ts';

/**
 * Which singing voices the Cantor engine currently has installed.
 *
 * Returns: { data: { voicebanks: [...] } }
 *
 * Discovered at runtime rather than hardcoded: voicebanks are installed on the
 * Space, each carries its own licence, and a stale hardcoded list would offer a
 * voice that cannot render.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const voicebanks = await listVoicebanks();
    return Response.json({ data: { voicebanks } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});