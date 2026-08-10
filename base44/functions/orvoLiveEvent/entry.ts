import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * ORVO live event lifecycle — Phase 4.
 * Payload: { event_id, action: 'start' | 'end' | 'join' | 'leave' }
 * Host-only for start/end; any signed-in listener may join/leave (presence count).
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event_id, action } = await req.json();
    if (!event_id || !action) return Response.json({ error: 'event_id and action are required' }, { status: 400 });

    const events = await base44.asServiceRole.entities.OrvoLiveEvent.filter({ id: event_id });
    const event = events?.[0];
    if (!event) return Response.json({ error: 'Live event not found' }, { status: 404 });

    const isHost = event.host_id === user.id || user.role === 'admin';

    if (action === 'start' || action === 'end') {
      if (!isHost) return Response.json({ error: 'Only the host can control this event' }, { status: 403 });
      const updated = await base44.asServiceRole.entities.OrvoLiveEvent.update(event_id, {
        status: action === 'start' ? 'live' : 'ended',
        ...(action === 'end' ? { listener_count: 0 } : {}),
      });
      return Response.json({ event: updated });
    }

    if (action === 'join' || action === 'leave') {
      const delta = action === 'join' ? 1 : -1;
      const next = Math.max(0, (event.listener_count || 0) + delta);
      const updated = await base44.asServiceRole.entities.OrvoLiveEvent.update(event_id, { listener_count: next });
      return Response.json({ event: updated });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}