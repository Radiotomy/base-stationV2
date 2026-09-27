import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { fetchAudiusGenrePool, sampleShuffled } from '../../shared/audiusDiscovery.ts';

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

// Genres that mean "no genre filter" — mixed/curated channels
const UNFILTERED_GENRES = new Set(['discover', 'staff-picks', 'all']);

// Map channel genre (labels AND DB slugs) → Audius genre values
const AUDIUS_GENRE_MAP = {
  'Hip Hop & Trap': 'Hip-Hop/Rap',
  'hip-hop': 'Hip-Hop/Rap',
  'trap': 'Hip-Hop/Rap',
  'EDM': 'Electronic',
  'edm': 'Electronic',
  'House': 'House',
  'Soul/R&B': 'R&B/Soul',
  'r&b': 'R&B/Soul',
  'Lo-Fi': 'Lo-Fi',
  'lo-fi': 'Lo-Fi',
  'Pop': 'Pop',
  'pop': 'Pop',
  'Cinematic': 'Ambient',
  'Rock': 'Rock',
  'rock': 'Rock',
  'Jazz': 'Jazz',
  'jazz': 'Jazz',
  'country': 'Country',
};

// Map channel genre (labels AND DB slugs) → community submission genre slugs
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
  'country': 'other',
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
    ai_label: t.ai_attribution_user_id ? 'ai_generated' : null,
    source: 'audius',
    audius_id: t.id,
    audius_user_id: t.user?.id || '',
    permalink: t.permalink || '',
    position: i,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Public endpoint — serves only Audius trending + approved community tracks,
    // so logged-out radio listeners can tune in too.

    let { genre, limit = 15 } = await req.json().catch(() => ({}));
    // "ai" channel = only AI tracks: community AI-labeled submissions (top-played)
    // + Audius tracks carrying opt-in AI attribution.
    const aiOnly = genre && String(genre).toLowerCase() === 'ai';
    if (aiOnly || (genre && UNFILTERED_GENRES.has(String(genre).toLowerCase()))) genre = null;

    // ── Audius trending tracks ──────────────────────────────────────────────
    let audiusTracks = [];
    try {
      const { base, headers, useAppName } = await resolveAudiusBase();
      const mappedGenre = genre ? AUDIUS_GENRE_MAP[genre] : null;
      // Deep pool (weekly + monthly + underground trending) sampled at random —
      // each tune-in gets a different mix instead of the same weekly top tracks.
      let pool;
      if (aiOnly) {
        // Trending rarely surfaces AI-attributed tracks — search for them instead
        // and keep only tracks carrying Audius's opt-in AI attribution.
        const queries = ['AI generated', 'AI music', 'made with AI'];
        const results = await Promise.all(queries.map(async (q) => {
          const qs = useAppName ? `&app_name=${APP_NAME}` : '';
          try {
            const r = await fetch(`${base}/tracks/search?query=${encodeURIComponent(q)}&limit=50${qs}`, { headers });
            const j = await r.json();
            return j?.data || [];
          } catch { return []; }
        }));
        const seen = new Set();
        pool = results.flat().filter((t) => {
          if (!t.ai_attribution_user_id || seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
        // Rank by play count → "top" AI tracks
        pool.sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
      } else {
        pool = await fetchAudiusGenrePool({ base, headers, useAppName, genre: mappedGenre, appName: APP_NAME });
      }
      const items = aiOnly ? pool.slice(0, limit) : sampleShuffled(pool, Math.ceil(limit * 0.6));
      audiusTracks = items.map((t, i) => normalizeAudiusTrack(t, i));
    } catch (e) {
      console.warn('Audius trending:', e.message);
    }

    // ── Community submissions (approved) ────────────────────────────────────
    let communityTracks = [];
    try {
      const communityGenre = genre ? (COMMUNITY_GENRE_MAP[genre] || genre.toLowerCase()) : null;
      const filter = aiOnly
        ? { status: 'approved', ai_label: { $in: ['ai_generated', 'ai_assisted'] } }
        : communityGenre
          ? { genre: communityGenre, status: 'approved' }
          : { status: 'approved' };
      // AI channel = "top" AI tracks — rank by play count and let community fill the queue
      const subs = await base44.asServiceRole.entities.TrackSubmission.filter(
        filter,
        aiOnly ? '-play_count' : '-created_date',
        aiOnly ? limit : Math.ceil(limit * 0.5)
      );
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

    // ── Protected BASE Station exports (watermarked + C2PA-sealed + anchored) ──
    let protectedTracks = [];
    try {
      const wantGenre = genre ? (COMMUNITY_GENRE_MAP[genre] || genre.toLowerCase()) : null;
      const regs = await base44.asServiceRole.entities.BaseTrackRegistry.filter(
        { registration_status: 'registered' }, '-registered_at', 60,
      );
      const eligible = regs.filter((r) =>
        r.c2pa_provenance_hash && r.track_url && !r.superseded_by_tx_hash
        && (!aiOnly || ['ai_generated', 'ai_assisted'].includes(r.ai_label))
        && (!wantGenre || (r.genre || '').toLowerCase() === wantGenre));
      protectedTracks = sampleShuffled(eligible, Math.ceil(limit * 0.3)).map((r, i) => ({
        track_title: r.track_title,
        artist_name: r.artist_name || 'BASE Station Artist',
        cover_image_url: r.cover_image_url || '',
        audio_url: r.track_url,
        duration_seconds: 0,
        genre: r.genre || '',
        ai_label: r.ai_label || null,
        source: 'community',
        base_protected: true,
        transaction_hash: r.transaction_hash,
        position: i,
      }));
    } catch (e) {
      console.warn('Protected tracks:', e.message);
    }

    // ── Interleave Audius + community + protected ───────────────────────────
    const queue = [];
    const maxLen = Math.max(audiusTracks.length, communityTracks.length, protectedTracks.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < audiusTracks.length) queue.push(audiusTracks[i]);
      if (i < protectedTracks.length) queue.push(protectedTracks[i]);
      if (i < communityTracks.length) queue.push(communityTracks[i]);
    }

    return Response.json({
      queue: queue.slice(0, limit * 2),
      audius_count: audiusTracks.length,
      community_count: communityTracks.length,
      protected_count: protectedTracks.length,
    });
  } catch (error) {
    return Response.json({ error: error.message, queue: [] }, { status: 500 });
  }
});