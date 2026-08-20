// Resolve a venue's current on-air state from stored records.
//
// Shared by the public now-playing endpoint and the stage driver so both agree
// on one question: is this venue live, idle-programmed, or dark? Two copies of
// this logic would eventually let the 3D room show idle content during a live
// show, which is the one failure the whole feature must not have.

import { resolveActivePlaylist, computeNowPlaying } from './venueIdle.ts';

export interface VenueIdleState {
  venue: any;
  isLive: boolean;
  liveSession: any | null;
  playlist: any | null;
  source: 'live' | 'schedule' | 'default' | 'none' | 'disabled';
  nowPlaying: any | null;
  block: any | null;
}

/**
 * A venue is LIVE when a session in that room is streaming. That check comes
 * first and unconditionally: idle programming must yield the stage the instant a
 * performance starts, and it is safer to show a static stage during a rare stale
 * session than to talk over an artist's live set.
 */
export async function resolveVenueIdleState(base44: any, venue: any, now: Date = new Date()): Promise<VenueIdleState> {
  let liveSession: any = null;
  if (venue?.room_id) {
    const sessions = await base44.asServiceRole.entities.LiveSession.filter({
      portal_room_id: venue.room_id,
      status: 'streaming',
    });
    liveSession = sessions?.[0] || null;
  }
  if (liveSession) {
    return { venue, isLive: true, liveSession, playlist: null, source: 'live', nowPlaying: null, block: null };
  }

  if (!venue?.idle_enabled) {
    return { venue, isLive: false, liveSession: null, playlist: null, source: 'disabled', nowPlaying: null, block: null };
  }

  const [playlists, schedules] = await Promise.all([
    base44.asServiceRole.entities.VenuePlaylist.filter({ venue_id: venue.id }),
    base44.asServiceRole.entities.VenueSchedule.filter({ venue_id: venue.id }),
  ]);

  const { playlist, source, block } = resolveActivePlaylist(playlists || [], schedules || [], now);
  if (!playlist) {
    return { venue, isLive: false, liveSession: null, playlist: null, source: 'none', nowPlaying: null, block: null };
  }

  return {
    venue,
    isLive: false,
    liveSession: null,
    playlist,
    source,
    block: block || null,
    nowPlaying: computeNowPlaying(playlist, now),
  };
}