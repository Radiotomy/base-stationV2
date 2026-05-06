import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 4 — Invite a co-performer to a LiveSession.
 * Adds them to state.participants with role="co-performer".
 *
 * Payload: { sessionId, userId, displayName? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, userId, displayName } = await req.json();
    if (!sessionId || !userId) {
      return Response.json({ error: 'sessionId and userId required' }, { status: 400 });
    }

    const arr = await base44.entities.LiveSession.filter({ id: sessionId });
    const session = arr[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    const participants = session?.state?.participants || [];
    if (participants.find(p => p.id === userId)) {
      return Response.json({ ok: true, already: true });
    }

    const updated = [
      ...participants,
      {
        id: userId,
        displayName: displayName || 'Co-Performer',
        type: 'performer',
        role: 'co-performer',
        is_live: false,
        avatar_state: {},
        avatarUrl: '',
      },
    ];

    await base44.entities.LiveSession.update(sessionId, {
      state: { ...(session.state || {}), participants: updated },
    });

    return Response.json({ ok: true, inviteUrl: `/live-studio?roomId=${sessionId}&role=co-performer` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});