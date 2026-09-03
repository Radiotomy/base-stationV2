import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Export a generated track as a downloadable MIDI file.
//
// Sonic path (audit 2026-09-03 — docs.aimusicapi.ai/api-32136908):
//   POST /api/v1/sonic/midi { clip_id } → { data: { midi_url, instruments[] } }
//   Real transcribed notes (pitch/start/end/velocity per detected instrument),
//   1 provider credit. Works on a full song or a single stem clip_id.
//   The old /sonic/export-midi call this function used to make does not exist.
//
// Fallback: a minimal scale MIDI built from tempo + key metadata, for tracks
// from providers that expose no clip_id.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { clip_id, bpm = 120, key = 'C', title = 'Track' } = await req.json();

    const sonicKey = Deno.env.get('SONIC_API_KEY');

    if (sonicKey && clip_id) {
      const sonicRes = await fetch('https://api.aimusicapi.ai/api/v1/sonic/midi', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sonicKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id }),
      });
      const sonicData = await sonicRes.json().catch(() => ({}));
      const midiUrl = sonicData?.data?.midi_url;
      if (sonicRes.ok && midiUrl) {
        await base44.asServiceRole.entities.APIUsageLog.create({
          user_id: user.id, user_email: user.email,
          provider: 'sonic', task: 'get_midi',
          credits_used: 1, status: 'success',
          timestamp: new Date().toISOString(),
          metadata: { clip_id, instrument_count: (sonicData.data.instruments || []).length },
        }).catch(() => {});
        return Response.json({
          midi_url: midiUrl,
          source: 'sonic',
          instruments: (sonicData.data.instruments || []).map((i) => ({ name: i.name, note_count: (i.notes || []).length })),
        });
      }
      console.warn('Sonic /midi unavailable, falling back to generated MIDI:', sonicData?.error || sonicData?.message || sonicRes.status);
    }

    // Fallback: generate a minimal MIDI file from tempo + key metadata
    // Standard MIDI file (format 0, 1 track, 480 ticks/beat)
    const midiBytes = buildMinimalMidi({ bpm, key, title });

    // Upload to storage and return URL
    const blob = new Blob([midiBytes], { type: 'audio/midi' });
    const formData = new FormData();
    formData.append('file', blob, `${title.replace(/\s+/g, '_')}.mid`);

    const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
    const midiUrl = uploadRes.file_url;

    return Response.json({ midi_url: midiUrl, source: 'generated', bpm, key });
  } catch (error) {
    console.error('exportMidi error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Build a minimal but valid MIDI file (Format 0) with a tempo track + chord
function buildMinimalMidi({ bpm, key, title }) {
  const microsPerBeat = Math.round(60_000_000 / bpm);

  // Key to MIDI root note map (C major = 60)
  const KEY_NOTE = {
    'C': 60, 'C#': 61, 'Db': 61, 'D': 62, 'D#': 63, 'Eb': 63,
    'E': 64, 'F': 65, 'F#': 66, 'Gb': 66, 'G': 67, 'G#': 68,
    'Ab': 68, 'A': 69, 'A#': 70, 'Bb': 70, 'B': 71,
  };
  const rootNote = KEY_NOTE[key?.replace(/m$/, '')] || 60;

  // Simple major scale pattern for 2 bars at 480 ticks/quarter
  const TICKS = 480;
  const scale = [0, 2, 4, 5, 7, 9, 11, 12];
  const events = [];

  scale.forEach((interval, i) => {
    const note = rootNote + interval;
    const startTick = i * TICKS;
    events.push({ tick: startTick, type: 'noteOn',  note, vel: 80 });
    events.push({ tick: startTick + TICKS - 20, type: 'noteOff', note, vel: 0 });
  });

  events.sort((a, b) => a.tick - b.tick);

  // Build track bytes
  const trackBytes = [];

  // Tempo meta event
  const t1 = (microsPerBeat >> 16) & 0xff;
  const t2 = (microsPerBeat >> 8) & 0xff;
  const t3 = microsPerBeat & 0xff;
  trackBytes.push(0x00, 0xFF, 0x51, 0x03, t1, t2, t3);

  // Track name
  const nameBytes = Array.from(new TextEncoder().encode(title.slice(0, 20)));
  trackBytes.push(0x00, 0xFF, 0x03, nameBytes.length, ...nameBytes);

  let currentTick = 0;
  for (const ev of events) {
    const delta = ev.tick - currentTick;
    currentTick = ev.tick;
    const deltaVLQ = toVLQ(delta);
    trackBytes.push(...deltaVLQ);
    if (ev.type === 'noteOn') {
      trackBytes.push(0x90, ev.note, ev.vel);
    } else {
      trackBytes.push(0x80, ev.note, ev.vel);
    }
  }

  // End of track
  trackBytes.push(0x00, 0xFF, 0x2F, 0x00);

  // Build header chunk
  const header = [
    0x4D, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06, // length = 6
    0x00, 0x00,             // format 0
    0x00, 0x01,             // 1 track
    0x01, 0xE0,             // 480 ticks/beat
  ];

  // Build track chunk
  const trackLen = trackBytes.length;
  const track = [
    0x4D, 0x54, 0x72, 0x6B, // MTrk
    (trackLen >> 24) & 0xff, (trackLen >> 16) & 0xff,
    (trackLen >> 8) & 0xff, trackLen & 0xff,
    ...trackBytes,
  ];

  return new Uint8Array([...header, ...track]);
}

function toVLQ(value) {
  if (value < 128) return [value];
  const bytes = [];
  bytes.unshift(value & 0x7F);
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7F) | 0x80);
    value >>= 7;
  }
  return bytes;
}