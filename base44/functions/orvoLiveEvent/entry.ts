import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * ORVO live event lifecycle — Phase 4.
 * Payload: { event_id, action: 'start' | 'end' | 'join' | 'leave' | 'autopilot_start' | 'autopilot_stop' }
 * Host-only for start/end/autopilot; any signed-in listener may join/leave (presence count).
 *
 * 'autopilot_start' puts a fully-rendered AI cast on air by stamping the clock
 * origin every surface derives the running order from. It refuses an unrendered
 * show on purpose: going live and then waiting on TTS would air silence.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event_id, action } = await req.json();
    if (!event_id || !action) return Response.json({ error: 'event_id and action are required' }, { status: 400 });

    const event = await base44.asServiceRole.entities.OrvoLiveEvent.get(event_id).catch(() => null);
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

    if (action === 'autopilot_start' || action === 'autopilot_stop') {
      if (!isHost) return Response.json({ error: 'Only the host can control this event' }, { status: 403 });

      if (action === 'autopilot_stop') {
        const stopped = await base44.asServiceRole.entities.OrvoLiveEvent.update(event_id, {
          status: 'ended',
          autopilot_status: 'ready',
          listener_count: 0,
        });
        return Response.json({ event: stopped });
      }

      const playable = (event.ai_script || []).filter((s) => s.audio_url);
      if (playable.length === 0) {
        return Response.json({ error: 'Render the show before putting it on air.' }, { status: 400 });
      }

      const started = await base44.asServiceRole.entities.OrvoLiveEvent.update(event_id, {
        status: 'live',
        autopilot_status: 'running',
        autopilot_started_at: new Date().toISOString(),
        autopilot_error: '',
      });
      return Response.json({ event: started });
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