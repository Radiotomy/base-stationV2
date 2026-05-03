import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LOUDLY_API_KEY = Deno.env.get('LOUDLY_API_KEY');
const BASE_URL = 'https://soundtracks.loudly.com';

// Uses POST /api/ai/prompt/songs — text-prompt-based generation (VEGA_2 model)
async function generateAISong({ genre, duration = 60, energy = 'high', bpm, mood, sound_prompt }) {
  const bpmHint = bpm ? ` at ${bpm} BPM` : '';
  const moodStr = mood || 'energetic';
  const prompt = sound_prompt
    ? `${sound_prompt}. ${moodStr} energy, ${genre} style${bpmHint}.`
    : `A ${energy}-energy ${moodStr} ${genre} track${bpmHint}.`;

  const form = new FormData();
  form.append('prompt', prompt);
  form.append('duration', String(Math.min(Math.max(duration, 30), 420)));
  form.append('model', 'VEGA_2');

  console.log('Loudly prompt:', prompt);
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

function normalizeTrack(t) {
  return {
    track_title: t.title || t.name || 'Untitled',
    artist_name: t.artist || 'Loudly',
    cover_image_url: t.cover_art_url || t.image_url || t.thumbnail_url || t.cover || '',
    audio_url: t.music_file_path || t.audio_url || t.url || t.preview_url || '',
    duration_seconds: Math.round(t.duration || 0),
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

    const { duration, mood, genre, tempo, job_id, energy } = await req.json();
    if (!LOUDLY_API_KEY) return Response.json({ error: 'LOUDLY_API_KEY not set' }, { status: 500 });

    // Generate via Loudly Soundtracks API (same as loudlyCatalog)
    const song = await generateAISong({
      genre,
      duration: duration || 60,
      energy: energy || 'high',
      bpm: tempo,
      mood,
    });

    const track = normalizeTrack(song);

    // Update job if job_id provided
    if (job_id) {
      await base44.asServiceRole.entities.GenerationJob.update(job_id, {
        status: 'completed',
        output_url: track.audio_url,
        output_metadata: {
          duration,
          bpm: track.bpm,
          key: track.key,
          genre,
        },
        provider_job_id: song.id,
        completed_at: new Date().toISOString()
      });
    }

    return Response.json({
      job_id,
      status: 'completed',
      audio_url: track.audio_url,
      metadata: { bpm: track.bpm, key: track.key, genre },
      raw: song,
    });
  } catch (error) {
    console.error('Loudly generation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});