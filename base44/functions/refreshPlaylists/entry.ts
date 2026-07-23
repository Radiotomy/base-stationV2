import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Admin maintenance: 1) remove playlist tracks whose audio is no longer accessible,
// 2) prune stale empty auto-generated playlists, 3) rebuild fresh Audius genre
// stations covering mainstream radio genres.

const APP_NAME = 'BaseStation';
const STATION_OWNER = 'BASE Station Radio';

const STATIONS = [
  { audiusGenre: 'Pop', title: 'Pop Hits Station', genre: 'pop', desc: "Today's trending pop, refreshed from Audius." },
  { audiusGenre: 'Rock', title: 'Rock Station', genre: 'rock', desc: 'Fresh rock & alternative, trending now.' },
  { audiusGenre: 'Hip-Hop/Rap', title: 'Hip-Hop & Rap Station', genre: 'hip-hop', desc: 'Trending hip-hop & rap heat.' },
  { audiusGenre: 'Electronic', title: 'Electronic Station', genre: 'edm', desc: 'Electronic & dance, straight off the charts.' },
  { audiusGenre: 'R&B/Soul', title: 'R&B & Soul Station', genre: 'r&b', desc: 'Smooth R&B and soul selections.' },
  { audiusGenre: 'Country', title: 'Country Station', genre: 'other', desc: 'Country & Americana on rotation.' },
  { audiusGenre: 'Lo-Fi', title: 'Lo-Fi Chill Station', genre: 'lo-fi', desc: 'Chill beats to create to.' },
  { audiusGenre: 'Jazz', title: 'Jazz Station', genre: 'jazz', desc: 'Jazz, fusion & late-night grooves.' },
];

async function resolveAudius() {
  let node = 'https://discoveryprovider.audius.co';
  try {
    const r = await fetch('https://api.audius.co');
    const j = await r.json();
    if (j?.data?.[0]) node = j.data[0];
  } catch (_) { /* keep default */ }
  const apiKey = Deno.env.get('AUDIUS_API_KEY');
  const useManaged = apiKey && apiKey.length > 8;
  return {
    metaBase: useManaged ? 'https://api.audius.co/v1' : `${node}/v1`,
    metaHeaders: useManaged ? { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } : { 'Accept': 'application/json' },
    useAppName: !useManaged,
    streamBase: `${node}/v1`, // streams must be publicly reachable from the browser
  };
}

async function isUrlAlive(url) {
  const check = async (method, headers) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { method, headers, redirect: 'follow', signal: ctrl.signal });
      return res.status;
    } catch (_) {
      return 0;
    } finally {
      clearTimeout(t);
    }
  };
  let status = await check('HEAD');
  if (status === 405 || status === 403 || status === 0) {
    status = await check('GET', { 'Range': 'bytes=0-0' });
  }
  return status >= 200 && status < 400;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole.entities;
    const summary = { removed_dead_tracks: 0, pruned_playlists: 0, stations: [] };

    const allPlaylists = await svc.Playlist.list('-created_date', 200);
    const stationTitles = new Set(STATIONS.map((s) => s.title));

    // ── 1. Cleanup: drop tracks whose audio is dead (skip stations — rebuilt below) ──
    const stationIds = new Set(allPlaylists.filter((p) => stationTitles.has(p.title)).map((p) => p.id));
    const allTracks = await svc.PlaylistTrack.list('-created_date', 500);
    const recount = new Set();
    for (const t of allTracks.filter((t) => !stationIds.has(t.playlist_id))) {
      const dead = !t.audio_url || !(await isUrlAlive(t.audio_url));
      if (dead) {
        await svc.PlaylistTrack.delete(t.id);
        summary.removed_dead_tracks++;
        recount.add(t.playlist_id);
      }
    }
    for (const pid of recount) {
      const remaining = await svc.PlaylistTrack.filter({ playlist_id: pid });
      try { await svc.Playlist.update(pid, { track_count: remaining.length }); } catch (_) { /* playlist may be gone */ }
    }

    // ── 1b. Approved community submissions with dead audio → unlist from radio/charts ──
    summary.unlisted_submissions = 0;
    const subs = await svc.TrackSubmission.filter({ status: 'approved' }, '-created_date', 200);
    for (const s of subs) {
      const dead = !s.track_url || !(await isUrlAlive(s.track_url));
      if (dead) {
        await svc.TrackSubmission.update(s.id, {
          status: 'rejected',
          description: `${s.description || ''} [auto-unlisted: audio link no longer accessible]`.trim(),
        });
        summary.unlisted_submissions++;
      }
    }

    // ── 2. Prune stale empty auto-generated playlists (never user-created ones) ──
    for (const p of allPlaylists) {
      if (p.owner_name === 'Base Station Radio' && !stationTitles.has(p.title)) {
        const tracks = await svc.PlaylistTrack.filter({ playlist_id: p.id });
        if (tracks.length === 0) {
          await svc.Playlist.delete(p.id);
          summary.pruned_playlists++;
        }
      }
    }

    // ── 3. Rebuild Audius genre stations with fresh trending content ──
    const { metaBase, metaHeaders, useAppName, streamBase } = await resolveAudius();
    const results = await Promise.all(STATIONS.map(async (station) => {
      const url = new URL(`${metaBase}/tracks/trending`);
      url.searchParams.set('time', 'week');
      url.searchParams.set('genre', station.audiusGenre);
      if (useAppName) url.searchParams.set('app_name', APP_NAME);
      try {
        const res = await fetch(url.toString(), { headers: metaHeaders });
        const json = await res.json();
        return { station, tracks: (json?.data || []).slice(0, 12) };
      } catch (_) {
        return { station, tracks: [] };
      }
    }));

    for (const { station, tracks } of results) {
      if (tracks.length === 0) {
        summary.stations.push({ title: station.title, tracks: 0, skipped: true });
        continue;
      }
      const cover = tracks[0]?.artwork?.['480x480'] || tracks[0]?.artwork?.['150x150'] || '';
      const existing = allPlaylists.find((p) => p.title === station.title);
      const fields = {
        title: station.title,
        description: station.desc,
        genre: station.genre,
        cover_image_url: cover,
        is_featured: true,
        is_public: true,
        owner_name: STATION_OWNER,
        track_count: tracks.length,
        tags: ['station', 'audius', station.genre],
      };
      let playlistId;
      if (existing) {
        playlistId = existing.id;
        await svc.Playlist.update(playlistId, fields);
        const old = await svc.PlaylistTrack.filter({ playlist_id: playlistId });
        for (const t of old) await svc.PlaylistTrack.delete(t.id);
      } else {
        const created = await svc.Playlist.create(fields);
        playlistId = created.id;
      }
      await svc.PlaylistTrack.bulkCreate(tracks.map((t, i) => ({
        playlist_id: playlistId,
        track_title: t.title || 'Untitled',
        artist_name: t.user?.name || t.user?.handle || 'Unknown',
        audio_url: `${streamBase}/tracks/${t.id}/stream?app_name=${APP_NAME}`,
        cover_image_url: t.artwork?.['480x480'] || t.artwork?.['150x150'] || '',
        duration_seconds: t.duration || null,
        genre: station.genre,
        position: i,
        source_type: 'external',
        source_id: t.id,
      })));
      summary.stations.push({ title: station.title, tracks: tracks.length });
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});