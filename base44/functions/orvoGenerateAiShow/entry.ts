// Writes the script for a fully AI-performed episode.
//
// Script only — nothing is voiced here. Scripting is one fast LLM call, while
// rendering is one TTS call per segment; keeping them apart means the creator
// gets a reviewable script in seconds and can edit it before a single second of
// speech is paid for.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generateShowScript, DEFAULT_CAST, totalSeconds } from '../../shared/orvoAiShow.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event_id, topic, cast, segment_count } = await req.json();
    if (!event_id || !topic?.trim()) {
      return Response.json({ error: 'event_id and topic are required' }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.OrvoLiveEvent.filter({ id: event_id });
    const event = rows?.[0];
    if (!event) return Response.json({ error: 'Live event not found' }, { status: 404 });
    if (event.host_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the show owner can script this episode' }, { status: 403 });
    }
    if (event.autopilot_status === 'running') {
      return Response.json({ error: 'The show is on air — end it before re-scripting.' }, { status: 400 });
    }

    const roster = Array.isArray(cast) && cast.length ? cast : (event.ai_cast?.length ? event.ai_cast : DEFAULT_CAST);
    const count = Math.min(20, Math.max(3, Number(segment_count) || 8));

    const script = await generateShowScript(base44, {
      title: event.title,
      topic: topic.trim(),
      cast: roster,
      segmentCount: count,
    });

    const updated = await base44.asServiceRole.entities.OrvoLiveEvent.update(event_id, {
      is_ai_cast: true,
      topic: topic.trim(),
      ai_cast: roster,
      ai_script: script,
      autopilot_status: 'scripted',
      autopilot_error: '',
      autopilot_started_at: null,
    });

    return Response.json({
      event: updated,
      segment_count: script.length,
      estimated_seconds: totalSeconds(script),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}