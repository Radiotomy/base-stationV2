import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 4 — Streamr audio subscriber (additive, optional).
 * Returns the public stream id and a polling URL fans can subscribe to.
 * No-op if STREAMR_PRIVATE_KEY missing.
 *
 * Payload: { roomId, performerId }
 */
const STREAMR_KEY = Deno.env.get('STREAMR_PRIVATE_KEY');
const STREAMR_API = Deno.env.get('STREAMR_API_BASE') || 'https://api.streamr.network/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomId, performerId } = await req.json();
    if (!roomId || !performerId) {
      return Response.json({ error: 'roomId and performerId required' }, { status: 400 });
    }

    const streamId = `${performerId}/basestation/live/${roomId}/audio`;

    if (!STREAMR_KEY) {
      return Response.json({ available: false, streamId, reason: 'streamr_disabled' });
    }

    return Response.json({
      available: true,
      streamId,
      pollUrl: `${STREAMR_API}/streams/${encodeURIComponent(streamId)}/data/last`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});