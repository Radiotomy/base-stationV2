// The idle driver: keeps every programmed venue's 3D stage showing whatever its
// playlist clock says is on air right now.
//
// It writes to Portals only when the on-air ITEM actually changes. A Portals
// upload replaces the whole room, so every needless write is a chance to lose
// something the artist placed by hand — the change check is a safety measure,
// not an optimisation. Playback position is never written anywhere: it is always
// derived from the playlist's cycle origin (see shared/venueIdle.ts).
//
// Modes:
//   { }                  — sweep every idle-enabled venue (scheduled workflow)
//   { venueId: "..." }   — force one venue now (owner pressing "Push to stage",
//                          or the live-session hand-back after a show ends)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveKeyForVenue, downloadRoomData, uploadRoomData } from '../../shared/portalsApi.ts';
import { getPreset, buildIdleScreen } from '../../shared/venuePresets.ts';
import { resolveVenueIdleState } from '../../shared/venueIdleState.ts';

// Even with nothing changing, the wall is refreshed occasionally so a room that
// was edited in Portals directly drifts back into agreement with the programme.
const REFRESH_AFTER_MS = 30 * 60 * 1000;

async function pushVenue(base44, venue, now) {
  const state = await resolveVenueIdleState(base44, venue, now);

  // A live performance owns the stage. Live Studio drives the screen during a
  // show, so the driver stands down rather than fighting it frame for frame.
  if (state.isLive) return { venueId: venue.id, action: 'skipped_live' };

  const item = state.nowPlaying?.item || null;
  const previous = venue.idle_now_playing || {};
  const lastPushed = Date.parse(venue.idle_last_pushed_at || '') || 0;
  const stale = now.getTime() - lastPushed > REFRESH_AFTER_MS;

  if (!item) {
    // Programming turned off or emptied — hand the wall back to the cover art
    // once, then leave the room alone.
    if (!previous.asset_id) return { venueId: venue.id, action: 'idle_none' };
    const { key } = await resolveKeyForVenue(base44, venue);
    const roomData = await downloadRoomData(venue.room_id, key);
    const items = { ...(roomData.roomItems || {}) };
    const preset = getPreset(venue.template_key);
    const cover = venue.cover_image_url
      ? buildIdleScreen(preset, { url: venue.cover_image_url, kind: 'audio', title: venue.name, subtitle: 'BASE Station venue' })
      : { items: {}, logic: {} };
    delete items['105'];
    await uploadRoomData(venue.room_id, key, {
      ...roomData,
      roomItems: { ...items, ...cover.items },
      logic: { ...(roomData.logic || {}), ...cover.logic },
    });
    await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
      idle_now_playing: {},
      idle_last_pushed_at: now.toISOString(),
    });
    return { venueId: venue.id, action: 'cleared' };
  }

  const unchanged = previous.asset_id === item.asset_id && previous.playlist_id === state.playlist?.id;
  if (unchanged && !stale) return { venueId: venue.id, action: 'unchanged' };

  const { key } = await resolveKeyForVenue(base44, venue);
  const roomData = await downloadRoomData(venue.room_id, key);
  const preset = getPreset(venue.template_key);
  const screen = buildIdleScreen(preset, {
    // An audio entry stages its cover art; with no artwork the venue's own cover
    // stands in, because an empty wall reads as a broken room, not as music.
    url: item.media_kind === 'video' ? item.file_url : (item.thumbnail_url || venue.cover_image_url || ''),
    kind: item.media_kind === 'video' ? 'video' : 'audio',
    title: item.title || '',
    subtitle: state.source === 'schedule' ? (state.block?.label || 'Now Playing') : 'Now Playing',
  });

  await uploadRoomData(venue.room_id, key, {
    ...roomData,
    roomItems: { ...(roomData.roomItems || {}), ...screen.items },
    logic: { ...(roomData.logic || {}), ...screen.logic },
  });

  await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
    idle_now_playing: {
      asset_id: item.asset_id || '',
      playlist_id: state.playlist?.id || '',
      playlist_title: state.playlist?.title || '',
      title: item.title || '',
      media_kind: item.media_kind || 'audio',
      thumbnail_url: item.thumbnail_url || '',
      file_url: item.file_url || '',
      source: state.source,
      index: state.nowPlaying.index,
      started_at: new Date(now.getTime() - (state.nowPlaying.offset_seconds || 0) * 1000).toISOString(),
    },
    idle_last_pushed_at: now.toISOString(),
  });

  return { venueId: venue.id, action: 'pushed', title: item.title || '' };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const now = new Date();

    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }

    if (body.venueId) {
      // A targeted push is open to anyone in the room, including unsigned-in
      // fans, because the in-world panel is what keeps the wall in step with the
      // programme between scheduled sweeps (cron cannot run more often than
      // every 5 minutes, and tracks are shorter than that). It is safe to expose:
      // the caller supplies no content, everything is derived from the venue's
      // own stored programme, and a repeat call is a no-op once the item matches.
      const rows = await base44.asServiceRole.entities.PortalVenue.filter({ id: body.venueId });
      const venue = rows?.[0];
      if (!venue) return Response.json({ error: 'Venue not found' }, { status: 404 });
      if (!venue.room_id) return Response.json({ error: 'Venue has no room' }, { status: 400 });
      const result = await pushVenue(base44, venue, now);
      return Response.json({ results: [result] });
    }

    // Sweep mode belongs to the scheduled workflow (which runs without a user);
    // a signed-in non-admin must not be able to drive every venue on the app.
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const venues = await base44.asServiceRole.entities.PortalVenue.filter({ idle_enabled: true, status: 'ready' });
    const results = [];
    for (const venue of venues || []) {
      if (!venue.room_id) continue;
      try {
        results.push(await pushVenue(base44, venue, now));
      } catch (err) {
        // One venue's Portals failure must not stop the rest of the sweep.
        results.push({ venueId: venue.id, action: 'failed', error: err.message });
      }
    }
    return Response.json({ swept: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}