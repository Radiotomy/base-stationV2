import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 4 — Streamr audio publisher (additive, optional).
 * No-op if STREAMR_PRIVATE_KEY is not set.
 *
 * Payload: { roomId, audioChunk (base64), codec? }
 * Returns: { published: boolean, streamId, reason? }
 */
const STREAMR_KEY = Deno.env.get('STREAMR_PRIVATE_KEY');
const STREAMR_API = Deno.env.get('STREAMR_API_BASE') || 'https://api.streamr.network/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomId, audioChunk, codec = 'opus' } = await req.json();
    if (!roomId) return Response.json({ error: 'roomId required' }, { status: 400 });

    const streamId = `${user.id}/basestation/live/${roomId}/audio`;

    if (!STREAMR_KEY) {
      return Response.json({ published: false, streamId, reason: 'streamr_disabled' });
    }
    if (!audioChunk) {
      return Response.json({ published: false, streamId, reason: 'no_chunk' });
    }

    // Lightweight publish — Streamr REST publish endpoint
    const res = await fetch(`${STREAMR_API}/streams/${encodeURIComponent(streamId)}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STREAMR_KEY}`,
      },
      body: JSON.stringify({ chunk: audioChunk, codec, ts: Date.now() }),
    }).catch(() => null);

    return Response.json({
      published: !!res?.ok,
      streamId,
      ...(res && !res.ok ? { reason: `http_${res.status}` } : {}),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});