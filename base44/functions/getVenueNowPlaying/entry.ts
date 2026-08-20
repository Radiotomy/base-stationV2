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

    const state = await resolveVenueIdleState(base44, venue);

    return Response.json({
      venue: {
        id: venue.id,
        name: venue.name,
        description: venue.description || '',
        cover_image_url: venue.cover_image_url || '',
        room_id: venue.room_id || '',
        template_key: venue.template_key || '',
      },
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