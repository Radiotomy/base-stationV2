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

    // Manage presence atomically (service role bypasses RLS): add the fan to
    // state.participants and append a 'join' event to state.recentEvents,
    // without clobbering the performer's nowPlaying.
    const participants = Array.isArray(session.state?.participants) ? session.state.participants : [];
    const alreadyIn = participants.some((p) => p.id === user.id);
    const updatedParticipants = alreadyIn ? participants : [
      ...participants,
      { id: user.id, displayName: user.full_name || 'Fan', type: 'fan', avatarUrl: '' },
    ];

    const recentEvents = Array.isArray(session.state?.recentEvents) ? session.state.recentEvents : [];
    const joinEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'join',
      payload: { userId: user.id, displayName: user.full_name || 'Fan', type: 'fan' },
      timestamp: new Date().toISOString(),
    };
    const updatedEvents = [...recentEvents, joinEvent].slice(-20);

    await base44.asServiceRole.entities.LiveSession.updateMany({ id: sessionId }, {
      $inc: { viewer_count: 1 },
      $set: {
        peak_viewers: newPeak,
        "state.participants": updatedParticipants,
        "state.recentEvents": updatedEvents,
      },
    });

    return Response.json({
      viewer_count: newCount,
      peak_viewers: newPeak,
      audio_mode: session.audio_mode || session.state?.audio_mode || 'sync',
      joined: !alreadyIn,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});