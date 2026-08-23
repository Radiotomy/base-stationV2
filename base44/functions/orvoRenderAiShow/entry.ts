// Voices the scripted show, a few segments per call.
//
// Batched rather than all-at-once on purpose: a 12-segment show is 12 TTS round
// trips plus 12 uploads, which would run past the request budget. The caller
// invokes this repeatedly and watches `remaining` fall to zero, so progress is
// visible and a failure costs one batch instead of the whole show.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { renderSegment, withTimeline } from '../../shared/orvoAiShow.ts';

const BATCH = 3;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event_id } = await req.json();
    if (!event_id) return Response.json({ error: 'event_id is required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.OrvoLiveEvent.filter({ id: event_id });
    const event = rows?.[0];
    if (!event) return Response.json({ error: 'Live event not found' }, { status: 404 });
    if (event.host_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the show owner can render this episode' }, { status: 403 });
    }

    const script = [...(event.ai_script || [])];
    if (script.length === 0) return Response.json({ error: 'Nothing scripted yet' }, { status: 400 });

    const inworldKey = secrets.get('INWORLD_API_KEY');
    const elevenKey = secrets.get('ELEVENLABS_API');

    const pending = script.filter((s) => !s.audio_url && s.status !== 'failed');
    const batch = pending.slice(0, BATCH);

    for (const segment of batch) {
      try {
        const { audio_url, seconds } = await renderSegment(base44, {
          segment,
          cast: event.ai_cast || [],
          inworldKey,
          elevenKey,
        });
        script[segment.index] = { ...script[segment.index], audio_url, seconds, status: 'rendered', error: '' };
      } catch (err) {
        // One bad segment must not abandon the show — it is recorded and the
        // creator can retry that line after editing it.
        script[segment.index] = { ...script[segment.index], status: 'failed', error: err.message.slice(0, 300) };
      }
    }

    // Durations are only known once a segment is voiced, so the running order is
    // re-placed after every batch.
    const timed = withTimeline(script);
    const remaining = timed.filter((s) => !s.audio_url && s.status !== 'failed').length;
    const failed = timed.filter((s) => s.status === 'failed').length;
    const rendered = timed.filter((s) => !!s.audio_url).length;

    const status = remaining > 0 ? 'rendering' : (rendered > 0 ? 'ready' : 'failed');

    const updated = await base44.asServiceRole.entities.OrvoLiveEvent.update(event_id, {
      ai_script: timed,
      autopilot_status: status,
      autopilot_error: rendered === 0 && failed > 0 ? 'Every segment failed to render.' : '',
    });

    return Response.json({ event: updated, rendered, remaining, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}