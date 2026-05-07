import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5.7 — atomic viewer_count + peak_viewers increment.
 * Called by LiveWatch on first mount so refreshes / tab restores
 * don't double-increment on the client.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId } = await req.json();
    if (!sessionId) return Response.json({ error: 'Missing sessionId' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.LiveSession.filter({ id: sessionId });
    const session = rows[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    const newCount = (session.viewer_count || 0) + 1;
    const newPeak = Math.max(session.peak_viewers || 0, newCount);

    await base44.asServiceRole.entities.LiveSession.update(sessionId, {
      viewer_count: newCount,
      peak_viewers: newPeak,
    });

    return Response.json({
      viewer_count: newCount,
      peak_viewers: newPeak,
      audio_mode: session.audio_mode || session.state?.audio_mode || 'sync',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});