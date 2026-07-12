import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Audius gateway resolver (Bearer or public discovery) ──────────────────────
const MANAGED_GATEWAY = 'https://api.audius.co/v1';
const DEFAULT_DISCOVERY = 'https://discoveryprovider.audius.co';
const APP_NAME = 'BaseStation';

async function resolveAudiusBase() {
  const apiKey = Deno.env.get('AUDIUS_API_KEY');
  if (apiKey && apiKey.length > 8) {
    return { base: MANAGED_GATEWAY, headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }, useAppName: false };
  }
  try {
    const r = await fetch('https://api.audius.co');
    const j = await r.json();
    const node = j?.data?.[0] || DEFAULT_DISCOVERY;
    return { base: `${node}/v1`, headers: { 'Accept': 'application/json' }, useAppName: true };
  } catch {
    return { base: `${DEFAULT_DISCOVERY}/v1`, headers: { 'Accept': 'application/json' }, useAppName: true };
  }
}

// Map our channel genre labels → Audius genre values
const AUDIUS_GENRE_MAP = {
  'Hip Hop & Trap': 'Hip-Hop/Rap',
  'EDM': 'Electronic',
  'House': 'House',
  'Soul/R&B': 'R&B/Soul',
  'Lo-Fi': 'Lo-Fi',
  'Pop': 'Pop',
  'Cinematic': 'Ambient',
  'Rock': 'Rock',
  'Jazz': 'Jazz',
};

// Map our channel genre labels → community submission genre slugs
const COMMUNITY_GENRE_MAP = {
  'Hip Hop & Trap': 'hip-hop',
  'EDM': 'edm',
  'Soul/R&B': 'r&b',
  'Lo-Fi': 'lo-fi',
  'Pop': 'pop',
  'House': 'edm',
  'Cinematic': 'other',
  'Rock': 'rock',
  'Jazz': 'jazz',
};

function normalizeAudiusTrack(t, i = 0) {
  // Audius streaming endpoint follows the v1 pattern: /tracks/{id}/stream
  const streamBase = MANAGED_GATEWAY;
  return {
    track_title: t.title || 'Untitled',
    artist_name: t.user?.name || t.user?.handle || 'Audius Artist',
    cover_image_url: t.artwork?.['480x480'] || t.artwork?.['150x150'] || t.artwork?.['1000x1000'] || '',
    audio_url: `${streamBase}/tracks/${t.id}/stream`,
    duration_seconds: t.duration || 0,
    genre: t.genre || '',
    source: 'audius',
    audius_id: t.id,
    permalink: t.permalink || '',
    position: i,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Public endpoint — serves only Audius trending + approved community tracks,
    // so logged-out radio listeners can tune in too.

    const { genre, limit = 15 } = await req.json().catch(() => ({}));

    // ── Audius trending tracks ──────────────────────────────────────────────
    let audiusTracks = [];
    try {
      const { base, headers, useAppName } = await resolveAudiusBase();
      const url = new URL(`${base}/tracks/trending`);
      if (useAppName) url.searchParams.set('app_name', APP_NAME);
      url.searchParams.set('time', 'week');
      const mappedGenre = genre ? AUDIUS_GENRE_MAP[genre] : null;
      if (mappedGenre) url.searchParams.set('genre', mappedGenre);
      const res = await fetch(url.toString(), { headers });
      const json = await res.json();
      const items = (json?.data || []).slice(0, Math.ceil(limit * 0.6));
      audiusTracks = items.map((t, i) => normalizeAudiusTrack(t, i));
    } catch (e) {
      console.warn('Audius trending:', e.message);
    }

    // ── Community submissions (approved) ────────────────────────────────────
    let communityTracks = [];
    try {
      const communityGenre = genre ? (COMMUNITY_GENRE_MAP[genre] || genre.toLowerCase()) : null;
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
        ai_label: s.ai_label || null,
        source: 'community',
        bpm: s.bpm || null,
        position: i,
      }));
    } catch (e) {
      console.warn('Community tracks:', e.message);
    }

    // ── Interleave Audius + community ───────────────────────────────────────
    const queue = [];
    const maxLen = Math.max(audiusTracks.length, communityTracks.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < audiusTracks.length) queue.push(audiusTracks[i]);
      if (i < communityTracks.length) queue.push(communityTracks[i]);
    }

    return Response.json({
      queue: queue.slice(0, limit * 2),
      audius_count: audiusTracks.length,
      community_count: communityTracks.length,
    });
  } catch (error) {
    return Response.json({ error: error.message, queue: [] }, { status: 500 });
  }
});