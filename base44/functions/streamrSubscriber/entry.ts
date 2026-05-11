import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5.8 — Streamr audio subscriber relay.
 * Returns:
 *   { available: false, reason } when Streamr is not configured.
 *   { available: true, streamId, chunk?, codec?, ts? } otherwise — `chunk` is the
 *   most recent base64 audio payload (or omitted if no data yet).
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

    // Fetch the most recent published chunk for this room.
    let chunk = null, codec = null, ts = null;
    try {
      const res = await fetch(`${STREAMR_API}/streams/${encodeURIComponent(streamId)}/data/last`, {
        headers: { 'Authorization': `Bearer ${STREAMR_KEY}` },
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body) {
          chunk = body.chunk || null;
          codec = body.codec || null;
          ts = body.ts || null;
        }
      }
    } catch { /* transient — caller will retry */ }

    return Response.json({ available: true, streamId, chunk, codec, ts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});