import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Trigger a live collectible drop in a session.
 * Sets active_drop_id on the LiveSession and pushes a "drop" event to recentEvents.
 *
 * Payload: { sessionId, collectibleId, durationSeconds? = 60 }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, collectibleId, durationSeconds = 60 } = await req.json();
    if (!sessionId || !collectibleId) {
      return Response.json({ error: 'sessionId and collectibleId required' }, { status: 400 });
    }

    const sArr = await base44.asServiceRole.entities.LiveSession.filter({ id: sessionId });
    const session = sArr[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    if (session.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const cArr = await base44.asServiceRole.entities.Collectible.filter({ id: collectibleId });
    const c = cArr[0];
    if (!c || !c.is_active) return Response.json({ error: 'Collectible not available' }, { status: 400 });
    if (c.origin === 'loudly') return Response.json({ error: 'Loudly-origin not droppable' }, { status: 403 });

    const dropEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'live-drop',
      payload: {
        collectible_id: collectibleId,
        name: c.name,
        media_url: c.media_url,
        supply_left: c.supply != null ? Math.max(0, c.supply - (c.claimed_count || 0)) : null,
        expires_at: new Date(Date.now() + durationSeconds * 1000).toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    const events = session?.state?.recentEvents || [];
    await base44.asServiceRole.entities.LiveSession.update(sessionId, {
      live_drops_enabled: true,
      active_drop_id: collectibleId,
      state: {
        ...(session.state || {}),
        recentEvents: [...events, dropEvent].slice(-20),
      },
    });

    return Response.json({ ok: true, drop: dropEvent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});