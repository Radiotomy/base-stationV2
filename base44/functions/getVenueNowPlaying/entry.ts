// What is playing in a venue right now — the read every fan-facing surface uses.
//
// Intentionally UNAUTHENTICATED: it backs the public venue page and the in-world
// welcome panel, and almost no fan in a shared 3D room is signed in to BASE
// Station. It therefore reads through the service role but returns only the
// venue's public face (name, cover, room link, programme) and never the owner's
// email, Portals credentials or venue settings.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveVenueIdleState } from '../../shared/venueIdleState.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const venueId = body.venueId || '';
    const roomId = body.roomId || '';
    if (!venueId && !roomId) {
      return Response.json({ error: 'venueId or roomId required' }, { status: 400 });
    }

    const rows = venueId
      ? await base44.asServiceRole.entities.PortalVenue.filter({ id: venueId })
      : await base44.asServiceRole.entities.PortalVenue.filter({ room_id: roomId });
    const venue = rows?.[0];
    if (!venue || venue.status === 'archived') {
      return Response.json({ error: 'Venue not found' }, { status: 404 });
    }
    // A private venue is closed to every fan-facing surface. Legacy venues have
    // no visibility set and stay reachable by link, which is what they were.
    if (venue.visibility === 'private') {
      return Response.json({ error: 'This venue is private' }, { status: 403 });
    }

    // Fan-club gate. Checked server-side because a gate applied in the browser is
    // only a suggestion. A signed-out fan simply fails the check — the venue's
    // public face still renders, so the join prompt reads as an invitation rather
    // than an error.
    let gateOpen = venue.access_gate !== 'fan_club';
    if (!gateOpen) {
      const viewer = await base44.auth.me().catch(() => null);
      if (viewer) {
        if (viewer.id === venue.user_id || viewer.role === 'admin') {
          gateOpen = true;
        } else {
          const memberships = await base44.asServiceRole.entities.FanClubMembership.filter({
            creator_id: venue.user_id,
            user_id: viewer.id,
            status: 'active',
          });
          gateOpen = (memberships || []).length > 0;
        }
      }
    }

    if (!gateOpen) {
      return Response.json({
        venue: {
          id: venue.id,
          name: venue.name,
          description: venue.description || '',
          cover_image_url: venue.cover_image_url || '',
          // Withheld deliberately: handing over the room link would defeat the gate.
          room_id: '',
          template_key: venue.template_key || '',
        },
        gated: true,
        creator_id: venue.user_id,
        is_live: false,
        live: null,
        source: '',
        channel: null,
        block_label: '',
        now_playing: null,
        server_time: new Date().toISOString(),
      });
    }

    const state = await resolveVenueIdleState(base44, venue);

    return Response.json({
      venue: {
        id: venue.id,
        name: venue.name,
        description: venue.description || '',
        cover_image_url: venue.cover_image_url || '',
        room_id: venue.room_id || '',
        template_key: venue.template_key || '',
        // Room transport state — the in-world panel needs it to show the current
        // level rather than guessing one and jumping on first touch.
        idle_volume: typeof venue.idle_volume === 'number' ? venue.idle_volume : 0.8,
        idle_paused: !!venue.idle_paused,
      },
      gated: false,
      is_live: state.isLive,
      live: state.isLive
        ? {
            session_id: state.liveSession.id,
            title: state.liveSession.title || '',
            track_title: state.liveSession.current_track_title || '',
            track_artist: state.liveSession.current_track_artist || '',
          }
        : null,
      source: state.source,
      // A private programme still plays; only its queue is withheld, so fans see
      // what is on now without the artist's whole upcoming programme.
      channel: state.playlist
        ? { id: state.playlist.id, title: state.playlist.title, listed: state.playlist.is_public !== false }
        : null,
      block_label: state.block?.label || '',
      now_playing: state.nowPlaying,
      // Server time so a client can correct for its own clock skew instead of
      // trusting a local Date that may be minutes off.
      server_time: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}