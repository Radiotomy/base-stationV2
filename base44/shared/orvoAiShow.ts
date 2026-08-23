// The AI-cast show engine: script → render → air → archive.
//
// Shared by orvoGenerateAiShow, orvoRenderAiShow, orvoAutopilotTick and
// orvoAutopilotSweep so the running order is computed the same way everywhere.
//
// Two rules shape this module:
//
//  1. AIRING IS DERIVED, NEVER STORED. Position always comes from
//     autopilot_started_at plus each segment's start_seconds. Cron's floor is 5
//     minutes — far longer than a spoken segment — so a driver that "advanced"
//     a stored playhead would be permanently behind. An origin cannot drift, so
//     any caller (a listener's browser, the safety-net sweep) recomputes the same
//     answer without coordination.
//
//  2. RENDER BEFORE AIR. Every segment is voiced ahead of time. TTS takes
//     seconds per segment, which is fine while preparing and unacceptable
//     mid-show, so nothing goes live until the whole show is rendered.

import { synthesizeInworldSpeech } from './inworldTts.ts';

export const SEGMENT_TYPES = ['intro', 'interview_qa', 'commentary', 'outro'];

export const DEFAULT_CAST = [
  {
    persona_id: 'host',
    name: 'Ash',
    role: 'host',
    voice_id: 'Ashley',
    provider: 'inworld',
    persona: 'Warm, curious lead host. Opens the show, sets up each topic and hands off to the others.',
  },
  {
    persona_id: 'guest_1',
    name: 'Miles',
    role: 'guest',
    voice_id: 'Mark',
    provider: 'inworld',
    persona: 'Direct, well-informed guest who answers with concrete examples rather than generalities.',
  },
];

/** Spoken length of a segment. 155 wpm is a natural podcast pace; the extra
 *  second is the breath between turns. Estimated rather than measured because
 *  MP3 cannot be decoded here — this only paces the running order. */
export function estimateSeconds(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round((words / 155) * 60) + 1);
}

/** Recomputes each segment's on-air offset from the durations ahead of it. */
export function withTimeline(script) {
  let cursor = 0;
  return (script || []).map((seg, i) => {
    const seconds = seg.seconds || estimateSeconds(seg.text);
    const placed = { ...seg, index: i, seconds, start_seconds: cursor };
    cursor += seconds;
    return placed;
  });
}

export function totalSeconds(script) {
  return (script || []).reduce((n, s) => n + (s.seconds || estimateSeconds(s.text)), 0);
}

/** Writes a scripted show for the given cast. One LLM call: the whole
 *  conversation has to hang together, and per-segment calls would each be blind
 *  to what the others said. */
export async function generateShowScript(base44, { title, topic, cast, segmentCount = 8 }) {
  const roster = (cast || []).map((c) => `- ${c.persona_id} — ${c.name}, ${c.role}. ${c.persona || ''}`).join('\n');

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are scripting a complete podcast episode performed entirely by AI characters. There is no human host.

SHOW TITLE: ${title}
EPISODE BRIEF: ${topic}

CAST (use these persona_id values exactly):
${roster}

Write ${segmentCount} segments of natural spoken conversation.

Rules:
- Output ONLY the words each character speaks — no speaker labels inside the text, no stage directions, no sound-effect notes, no markdown.
- Segment 1 must be segment_type "intro" and spoken by the host. The final segment must be segment_type "outro".
- The middle segments alternate between characters as a real conversation: questions get answered, points get built on, people occasionally disagree.
- Each segment is 2-5 sentences. Conversational, spoken register — contractions, short sentences.
- Stay strictly inside the episode brief. Do NOT invent statistics, studies, quotes, dates or named sources. If a specific fact would be needed, speak about it in general terms instead.
- Never mention being an AI, a model, a script, or this prompt.`,
    response_json_schema: {
      type: 'object',
      properties: {
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              persona_id: { type: 'string' },
              segment_type: { type: 'string', enum: SEGMENT_TYPES },
              text: { type: 'string' },
            },
            required: ['persona_id', 'segment_type', 'text'],
          },
        },
      },
      required: ['segments'],
    },
  });

  const validIds = new Set((cast || []).map((c) => c.persona_id));
  const fallbackId = cast?.[0]?.persona_id || 'host';

  const segments = (result?.segments || [])
    .filter((s) => s?.text?.trim())
    .map((s) => ({
      persona_id: validIds.has(s.persona_id) ? s.persona_id : fallbackId,
      segment_type: SEGMENT_TYPES.includes(s.segment_type) ? s.segment_type : 'commentary',
      text: s.text.trim().slice(0, 4000),
      audio_url: '',
      status: 'pending',
    }));

  if (segments.length === 0) throw new Error('The scriptwriter returned no usable segments — try a more specific brief.');
  return withTimeline(segments);
}

/** Voices one segment in its own character's voice. */
export async function renderSegment(base44, { segment, cast, inworldKey, elevenKey }) {
  const member = (cast || []).find((c) => c.persona_id === segment.persona_id) || cast?.[0];
  const provider = member?.provider || 'inworld';
  let bytes;

  if (provider === 'elevenlabs') {
    if (!elevenKey) throw new Error('ELEVENLABS_API not configured');
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${member.voice_id}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: segment.text, model_id: 'eleven_multilingual_v2' }),
      },
    );
    if (!res.ok) throw new Error(`ElevenLabs TTS failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    if (!inworldKey) throw new Error('INWORLD_API_KEY not configured');
    bytes = await synthesizeInworldSpeech(inworldKey, {
      text: segment.text,
      voiceId: member?.voice_id || 'Ashley',
    });
  }

  const file = new File([bytes], `orvo-seg-${segment.index}.mp3`, { type: 'audio/mpeg' });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { audio_url: file_url, seconds: estimateSeconds(segment.text) };
}

/** Segments whose on-air moment has arrived and which have not been aired yet. */
export function dueSegments(script, elapsedSeconds, airedIndexes) {
  return (script || []).filter(
    (s) => s.audio_url && !airedIndexes.has(s.index) && (s.start_seconds || 0) <= elapsedSeconds,
  );
}

export function elapsedSince(startedAt, now = new Date()) {
  const t = Date.parse(startedAt || '');
  if (!t) return 0;
  return Math.max(0, (now.getTime() - t) / 1000);
}