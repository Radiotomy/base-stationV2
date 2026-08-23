// Safety net for AI-cast shows with nobody in the room.
//
// A show normally keeps time because the listeners present each tick it (the
// tick is derived and idempotent, so any number of callers converge on the same
// answer). An empty room has no ticker, and a show must still finish and
// archive itself — that is this sweep's only job.
//
// Sweep mode touches every show on the app, so it is closed: an admin, or the
// shared token that only the scheduled workflow carries (the schedule runs with
// no signed-in user, so a role check alone would lock it out) — the same
// arrangement the venue sweep uses.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { tickEvent } from '../../shared/orvoAiShowDriver.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }

    const sweepToken = secrets.get('VENUE_SWEEP_TOKEN') || '';
    const tokenOk = !!sweepToken && body.token === sweepToken;
    if (!tokenOk && user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const events = await base44.asServiceRole.entities.OrvoLiveEvent.filter({
      is_ai_cast: true,
      autopilot_status: 'running',
    });

    const results = [];
    for (const event of events || []) {
      try {
        results.push({ event_id: event.id, ...(await tickEvent(base44, event)) });
      } catch (err) {
        // One stalled show must not stop the rest of the sweep.
        await base44.asServiceRole.entities.OrvoLiveEvent
          .update(event.id, { autopilot_status: 'failed', autopilot_error: err.message.slice(0, 300) })
          .catch(() => {});
        results.push({ event_id: event.id, action: 'failed', error: err.message });
      }
    }

    return Response.json({ swept: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}