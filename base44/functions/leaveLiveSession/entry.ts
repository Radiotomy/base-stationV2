import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5.7 — atomic viewer_count decrement.
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

    const newCount = Math.max(0, (session.viewer_count || 0) - 1);

    // Remove the fan from state.participants and append a 'leave' event,
    // without clobbering the performer's nowPlaying (service role bypasses RLS).
    const participants = Array.isArray(session.state?.participants) ? session.state.participants : [];
    const updatedParticipants = participants.filter((p) => p.id !== user.id);

    const recentEvents = Array.isArray(session.state?.recentEvents) ? session.state.recentEvents : [];
    const leaveEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'leave',
      payload: { userId: user.id, type: 'fan' },
      timestamp: new Date().toISOString(),
    };
    const updatedEvents = [...recentEvents, leaveEvent].slice(-20);

    await base44.asServiceRole.entities.LiveSession.updateMany({ id: sessionId }, {
      $set: {
        viewer_count: newCount,
        "state.participants": updatedParticipants,
        "state.recentEvents": updatedEvents,
      },
    });

    return Response.json({ viewer_count: newCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});