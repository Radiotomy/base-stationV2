// The autopilot conductor, shared by the per-event tick and the scheduled sweep.
//
// It lives here rather than in either function because both drive a show the
// same way and a second copy would be a second definition of when a segment
// goes on air.
//
// The tick is DERIVED and IDEMPOTENT: it reads the show's start instant, works
// out what should already have aired, and publishes only what is missing. Any
// number of callers therefore converge on the same transcript — which is what
// lets the listeners in the room keep time (cron's 5-minute floor is longer than
// most segments) while the sweep merely covers an empty room.

import { dueSegments, elapsedSince, totalSeconds } from './orvoAiShow.ts';
import { concatMp3 } from './mp3Concat.ts';

async function finalize(base44, event) {
  const script = (event.ai_script || []).filter((s) => s.audio_url);

  // Stitch the performance into one deliverable, in aired order.
  const parts = [];
  for (const seg of script) {
    const res = await fetch(seg.audio_url);
    if (!res.ok) continue;
    parts.push(new Uint8Array(await res.arrayBuffer()));
  }
  if (parts.length === 0) throw new Error('No rendered audio to archive');

  const joined = concatMp3(parts);
  const file = new File([joined], `orvo-ai-show-${event.id}.mp3`, { type: 'audio/mpeg' });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

  const castNames = (event.ai_cast || []).map((c) => `${c.name} (${c.role})`).join(', ');

  const episode = await base44.asServiceRole.entities.Episode.create({
    podcast_id: event.podcast_id,
    user_id: event.host_id,
    title: event.title,
    description: `${event.description || event.topic || ''}\n\nPerformed by an AI cast: ${castNames}.`.trim().slice(0, 4000),
    audio_url: file_url,
    storage_audio_url: file_url,
    duration_seconds: Math.round(totalSeconds(script)),
    status: 'published',
    published_date: new Date().toISOString(),
    // Disclosure is DECLARED, and here the platform itself is the maker: every
    // word and every voice came from a generative model, so the label is a fact
    // we already hold rather than something to infer from the audio later.
    declared_origin: 'ai_generated',
    ai_disclosure_label: 'ai_generated',
    ai_disclosure_basis:
      'Fully AI-performed episode: script written by an LLM and voiced by synthetic voices via the ORVO AI-cast autopilot. No human performance is present in this recording.',
    human_participation_score: 0,
    participation_signals: {
      ai_cast: true,
      human_brief_provided: !!event.topic,
      segments: script.length,
      cast_size: (event.ai_cast || []).length,
    },
  });

  const updated = await base44.asServiceRole.entities.OrvoLiveEvent.update(event.id, {
    status: 'ended',
    autopilot_status: 'done',
    recording_url: file_url,
    archived_episode_id: episode.id,
    listener_count: 0,
  });

  return { action: 'finalized', episode_id: episode.id, event: updated };
}

export async function tickEvent(base44, event) {
  if (!event.is_ai_cast) return { action: 'not_ai_cast' };
  if (event.autopilot_status === 'done') return { action: 'already_done' };
  if (event.autopilot_status !== 'running' || !event.autopilot_started_at) return { action: 'not_running' };

  const script = event.ai_script || [];
  const existing = await base44.asServiceRole.entities.OrvoLiveTurn.filter({ event_id: event.id }, 'segment_index', 200);
  const aired = new Set((existing || []).map((t) => t.segment_index).filter((n) => typeof n === 'number'));

  const elapsed = elapsedSince(event.autopilot_started_at);
  const due = dueSegments(script, elapsed, aired);

  for (const seg of due) {
    const member = (event.ai_cast || []).find((c) => c.persona_id === seg.persona_id);
    await base44.asServiceRole.entities.OrvoLiveTurn.create({
      event_id: event.id,
      podcast_id: event.podcast_id,
      speaker: 'ai_persona',
      persona_id: seg.persona_id,
      persona_name: member?.name || seg.persona_id,
      segment_type: seg.segment_type,
      segment_index: seg.index,
      text: seg.text,
      audio_url: seg.audio_url,
      voice_id: member?.voice_id || '',
    });
    aired.add(seg.index);
  }

  const playable = script.filter((s) => s.audio_url);
  const finished = playable.length > 0 && aired.size >= playable.length && elapsed >= totalSeconds(playable);

  if (finished) {
    await base44.asServiceRole.entities.OrvoLiveEvent.update(event.id, { autopilot_status: 'finalizing' });
    return await finalize(base44, event);
  }

  return { action: 'aired', published: due.length, elapsed: Math.round(elapsed) };
}