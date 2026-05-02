import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LOUDLY_API_KEY = Deno.env.get('LOUDLY_API_KEY');
const BASE_URL = 'https://soundtracks.loudly.com';

function loudlyHeaders() {
  return { 'API-KEY': LOUDLY_API_KEY, 'Accept': 'application/json' };
}

// Normalize a Loudly catalog/AI song to our internal track shape
function normalizeTrack(t, position = 0) {
  return {
    track_title: t.title || t.name || 'Untitled',
    artist_name: t.artist || 'Loudly',
    cover_image_url: t.cover_art_url || t.image_url || t.thumbnail_url || t.cover || '',
    // AI songs use music_file_path; catalog songs use audio_url/url/preview_url
    audio_url: t.music_file_path || t.audio_url || t.url || t.preview_url || '',
    duration_seconds: Math.round((t.duration || 0) / (t.music_file_path ? 1 : 1)), // AI songs: seconds; catalog: check
    genre: t.genre || '',
    source: 'loudly',
    loudly_id: t.id || '',
    bpm: t.bpm || null,
    key: t.key?.name || t.key || '',
    position,
  };
}

// Search Loudly catalog: GET /api/songs
async function searchCatalog({ genre, mood, limit = 20, page = 1 }) {
  const params = new URLSearchParams();
  if (genre) params.set('genre', genre);
  if (mood) params.set('mood', mood);
  params.set('limit', String(limit));
  params.set('page', String(page));

  const res = await fetch(`${BASE_URL}/api/songs?${params}`, { headers: loudlyHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || `Catalog error ${res.status}`);
  // Response shape: { items: [...], pagination_data: {...} }
  return (data.items || data.songs || data || []);
}

// Get available tags (genres/moods): GET /api/songs/tags
async function getTags() {
  const res = await fetch(`${BASE_URL}/api/songs/tags`, { headers: loudlyHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Tags error ${res.status}`);
  return data;
}

// Genre IDs for Loudly AI generation
const LOUDLY_GENRE_IDS = {
  'Ambient': 1, 'Classical': 2, 'Country': 3, 'Electronic': 4, 'EDM': 4,
  'Folk': 5, 'Hip Hop & Trap': 6, 'Hip-Hop': 6, 'Trap': 6,
  'Jazz': 7, 'Latin': 8, 'Pop': 9, 'R&B/Soul': 10, 'R&B': 10,
  'Rock': 11, 'World': 12, 'Lo-Fi': 4, 'House': 4, 'Drill': 6, 'Afrobeats': 12,
};

// Generate an AI song via Loudly: POST /api/ai/songs (multipart/form-data)
// genre_id (int) is required — NOT a string genre name
async function generateAISong({ genre, duration = 60, energy = 'high', bpm }) {
  const genreId = LOUDLY_GENRE_IDS[genre] || 9; // default Pop
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
  // Response: { id, title, music_file_path, bpm, key: { name }, duration }
  return data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (!LOUDLY_API_KEY) return Response.json({ error: 'LOUDLY_API_KEY not set' }, { status: 500 });

    // ── Search catalog ──────────────────────────────────────────────────────
    if (action === 'search') {
      const { genre, mood, limit = 20, page = 1 } = body;
      const items = await searchCatalog({ genre, mood, limit, page });
      const tracks = items.map((t, i) => normalizeTrack(t, i));
      return Response.json({ tracks, total: tracks.length });
    }

    // ── Get tags (genres/moods) ─────────────────────────────────────────────
    if (action === 'tags') {
      const data = await getTags();
      return Response.json({ tags: data });
    }

    // ── Build radio queue: Loudly catalog + community submissions ───────────
    if (action === 'radio_queue') {
      const { genre, mood, limit = 15 } = body;

      // Loudly catalog tracks
      let loudlyTracks = [];
      try {
        const items = await searchCatalog({
          genre: genre && genre !== 'discover' ? genre : undefined,
          mood,
          limit: Math.ceil(limit * 0.6),
        });
        loudlyTracks = items.map((t, i) => normalizeTrack(t, i));
      } catch (e) {
        console.warn('Loudly catalog:', e.message);
      }

      // Map Loudly genre names → community submission genre slugs
      const GENRE_MAP = {
        'Hip Hop & Trap': 'hip-hop', 'EDM': 'edm', 'Soul/R&B': 'r&b',
        'Lo-Fi': 'lo-fi', 'Lo-Fi Hip Hop ': 'lo-fi', 'Pop': 'pop',
        'House': 'edm', 'Deep House ': 'edm', 'Cinematic': 'other',
        'Rock': 'rock', 'Jazz': 'jazz', 'Ambient': 'other',
      };
      const communityGenre = genre ? (GENRE_MAP[genre] || genre.toLowerCase()) : null;

      // Community submissions (approved)
      let communityTracks = [];
      try {
        const filter = communityGenre
          ? { genre: communityGenre, status: 'approved' }
          : { status: 'approved' };
        const subs = await base44.asServiceRole.entities.TrackSubmission.filter(filter, '-created_date', Math.ceil(limit * 0.5));
        communityTracks = subs.map((s, i) => ({
          track_title: s.title,
          artist_name: s.artist_name || 'Community Artist',
          cover_image_url: s.cover_image_url || '',
          audio_url: s.track_url || '',
          duration_seconds: s.duration_seconds || 0,
          genre: s.genre || '',
          source: 'community',
          bpm: s.bpm || null,
          position: i,
        }));
      } catch (e) {
        console.warn('Community tracks:', e.message);
      }

      // Interleave Loudly + community
      const queue = [];
      const maxLen = Math.max(loudlyTracks.length, communityTracks.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < loudlyTracks.length) queue.push(loudlyTracks[i]);
        if (i < communityTracks.length) queue.push(communityTracks[i]);
      }

      return Response.json({
        queue: queue.slice(0, limit * 2),
        loudly_count: loudlyTracks.length,
        community_count: communityTracks.length,
      });
    }

    // ── Build & persist a dynamic playlist ─────────────────────────────────
    if (action === 'build_playlist') {
      const { genre, mood, name, description } = body;

      let loudlyTracks = [];
      try {
        const items = await searchCatalog({ genre, mood, limit: 15 });
        loudlyTracks = items.map((t, i) => normalizeTrack(t, i));
      } catch (e) {
        console.warn('Loudly catalog (build):', e.message);
      }

      let communityTracks = [];
      try {
        const filter = genre ? { genre, status: 'approved' } : { status: 'approved' };
        const subs = await base44.asServiceRole.entities.TrackSubmission.filter(filter, '-like_count', 10);
        communityTracks = subs.map((s, i) => ({
          track_title: s.title, artist_name: s.artist_name || 'Community',
          cover_image_url: s.cover_image_url || '', audio_url: s.track_url || '',
          duration_seconds: 0, genre: s.genre || genre || '',
          source: 'community', position: i,
        }));
      } catch (e) {
        console.warn('Community tracks (build):', e.message);
      }

      // Interleave
      const allTracks = [];
      const maxLen = Math.max(loudlyTracks.length, communityTracks.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < loudlyTracks.length) allTracks.push({ ...loudlyTracks[i], position: allTracks.length });
        if (i < communityTracks.length) allTracks.push({ ...communityTracks[i], position: allTracks.length });
      }

      // Create Playlist entity
      const playlist = await base44.asServiceRole.entities.Playlist.create({
        title: name || `${genre ? genre.charAt(0).toUpperCase() + genre.slice(1) : 'Mixed'} Radio Mix`,
        description: description || `Auto-generated Loudly + community playlist — ${[genre, mood].filter(Boolean).join(' / ')}`,
        genre: genre || 'all',
        is_featured: false,
        is_public: true,
        track_count: allTracks.length,
        owner_name: 'Base Station Radio',
        tags: [genre, mood, 'radio', 'loudly', 'auto'].filter(Boolean),
      });

      // Persist tracks
      const created = await Promise.all(
        allTracks.map(t =>
          base44.asServiceRole.entities.PlaylistTrack.create({
            playlist_id: playlist.id,
            track_title: t.track_title,
            artist_name: t.artist_name,
            cover_image_url: t.cover_image_url,
            audio_url: t.audio_url,
            duration_seconds: t.duration_seconds || 0,
            position: t.position,
            added_by: user.email,
            metadata: { source: t.source, loudly_id: t.loudly_id || null, bpm: t.bpm, key: t.key },
          }).catch(() => null)
        )
      );

      return Response.json({
        playlist_id: playlist.id,
        playlist,
        track_count: created.filter(Boolean).length,
        loudly_count: loudlyTracks.length,
        community_count: communityTracks.length,
      });
    }

    // ── Generate a new Loudly AI track ─────────────────────────────────────
    if (action === 'generate') {
      const { genre, duration = 60, energy = 'high', bpm } = body;
      const song = await generateAISong({ genre, duration, energy, bpm });
      // song.music_file_path is the audio URL; song.duration is in seconds
      const track = normalizeTrack(song);
      return Response.json({ track, raw: song });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});