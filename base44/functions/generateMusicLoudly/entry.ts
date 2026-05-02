import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LOUDLY_API_KEY = Deno.env.get('LOUDLY_API_KEY');
const BASE_URL = 'https://soundtracks.loudly.com';

const LOUDLY_GENRE_IDS = {
  'Ambient': 1, 'Classical': 2, 'Country': 3, 'Electronic': 4, 'EDM': 4,
  'Folk': 5, 'Hip Hop & Trap': 6, 'Hip-Hop': 6, 'Trap': 6,
  'Jazz': 7, 'Latin': 8, 'Pop': 9, 'R&B/Soul': 10, 'R&B': 10,
  'Rock': 11, 'World': 12, 'Lo-Fi': 4, 'House': 4, 'Drill': 6, 'Afrobeats': 12,
};

async function generateAISong({ genre, duration = 60, energy = 'high', bpm }) {
  const genreId = LOUDLY_GENRE_IDS[genre] || 9;
  const form = new FormData();
  form.append('genre_id', String(genreId));
  form.append('duration', String(Math.min(Math.max(duration, 30), 420)));
  if (energy) form.append('energy', energy);
  if (bpm) form.append('bpm', String(bpm));

  const res = await fetch(`${BASE_URL}/api/ai/songs`, {
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