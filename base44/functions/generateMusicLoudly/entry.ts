import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LOUDLY_API_KEY = Deno.env.get('LOUDLY_API_KEY');
const BASE_URL = 'https://soundtracks.loudly.com';

// POST /api/ai/prompt/songs — generate song from text prompt
async function generateAISong({ genre, duration = 60, bpm, mood, sound_prompt, structure_id, model }) {
  const bpmHint = bpm ? ` at ${bpm} BPM` : '';
  const moodStr = mood || 'energetic';
  const prompt = sound_prompt
    ? `${sound_prompt}. ${moodStr} energy, ${genre} style${bpmHint}.`
    : `A ${moodStr} ${genre} track${bpmHint}.`;

  const form = new FormData();
  form.append('prompt', prompt);
  form.append('duration', String(Math.min(Math.max(duration, 30), 420)));
  form.append('model', model || 'VEGA_2');
  if (structure_id !== undefined) form.append('structure_id', String(structure_id));

  console.log('Loudly prompt:', prompt, '| structure_id:', structure_id);
  const res = await fetch(`${BASE_URL}/api/ai/prompt/songs`, {
    method: 'POST',
    headers: { 'API-KEY': LOUDLY_API_KEY },
    body: form,
  });
  const data = await res.json();
  console.log('Loudly AI generate response:', JSON.stringify(data));
  if (!res.ok) throw new Error(data.error || `AI generation error ${res.status}`);
  return data;
}

// GET /api/ai/prompt/random — returns a random inspiration prompt
async function getRandomPrompt() {
  const res = await fetch(`${BASE_URL}/api/ai/prompt/random`, {
    headers: { 'API-KEY': LOUDLY_API_KEY, 'Accept': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Random prompt error ${res.status}`);
  return data.prompt;
}

// GET /api/ai/structures — returns available song structures
async function getStructures() {
  const res = await fetch(`${BASE_URL}/api/ai/structures`, {
    headers: { 'API-KEY': LOUDLY_API_KEY, 'Accept': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Structures error ${res.status}`);
  return data;
}

function normalizeTrack(t) {
  return {
    track_title: t.title || t.name || 'Untitled',
    artist_name: t.artist || 'Loudly',
    cover_image_url: t.cover_art_url || t.image_url || t.thumbnail_url || t.cover || '',
    audio_url: t.music_file_path || t.audio_url || t.url || t.preview_url || '',
    duration_seconds: Math.round((t.duration || 0) / 1000),
    genre: t.genre || '',
    source: 'loudly',
    loudly_id: t.id || '',
    bpm: t.bpm || null,
    key: t.key?.name || t.key || '',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!LOUDLY_API_KEY) return Response.json({ error: 'LOUDLY_API_KEY not set' }, { status: 500 });

    const body = await req.json();
    const { action = 'generate', duration, mood, genre, tempo, job_id, sound_prompt, structure_id } = body;

    // ── Get available structures ─────────────────────────────────────────────
    if (action === 'structures') {
      const structures = await getStructures();
      return Response.json({ structures });
    }

    // ── Get a random inspiration prompt ─────────────────────────────────────
    if (action === 'random_prompt') {
      const prompt = await getRandomPrompt();
      return Response.json({ prompt });
    }

    // ── Generate song (default) ──────────────────────────────────────────────
    const { model: bodyModel } = body;
    const song = await generateAISong({
      genre,
      duration: duration || 60,
      bpm: tempo,
      mood,
      sound_prompt,
      structure_id,
      model: bodyModel,
    });

    const track = normalizeTrack(song);

    if (job_id) {
      await base44.asServiceRole.entities.GenerationJob.update(job_id, {
        status: 'completed',
        output_url: track.audio_url,
        output_metadata: { duration, bpm: track.bpm, key: track.key, genre },
        provider_job_id: song.id,
        completed_at: new Date().toISOString(),
      });
    }

    return Response.json({
      job_id,
      status: 'completed',
      audio_url: track.audio_url,
      metadata: { bpm: track.bpm, key: track.key, genre, model: song.model },
      raw: song,
    });
  } catch (error) {
    console.error('Loudly generation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});