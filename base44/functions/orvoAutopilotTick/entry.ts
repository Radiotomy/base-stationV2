// Puts each rendered segment of an AI-cast show on air at its moment, and
// archives the finished show as a published episode.
//
// Open to any caller in the room, exactly like the venue idle push: the caller
// supplies NO content, everything is derived from the event's own stored script
// and its start instant, and a repeat call is a no-op once a segment is already
// aired. That openness is what makes the show hold time — cron cannot fire more
// often than every 5 minutes, which is longer than most segments, so the
// listeners present keep the transcript in step and the scheduled sweep is only
// a safety net for an empty room.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { tickEvent } from '../../shared/orvoAiShowDriver.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { event_id } = await req.json().catch(() => ({}));
    if (!event_id) return Response.json({ error: 'event_id is required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.OrvoLiveEvent.filter({ id: event_id });
    const event = rows?.[0];
    if (!event) return Response.json({ error: 'Live event not found' }, { status: 404 });

    const result = await tickEvent(base44, event);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}