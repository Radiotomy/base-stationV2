// The public venue directory — every venue a creator has opted into being found.
//
// Intentionally UNAUTHENTICATED, like getVenueNowPlaying: this is a discovery
// surface for fans who have no BASE Station account. It therefore reads through
// the service role but returns only a venue's public face, and lists ONLY venues
// whose creator explicitly set visibility to 'public'. An unlisted venue still
// plays for anyone holding its link; it simply never appears here.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveVenueIdleState } from '../../shared/venueIdleState.ts';

const MAX_VENUES = 48;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const venues = await base44.asServiceRole.entities.PortalVenue.filter(
      { status: 'ready', visibility: 'public' },
      '-updated_date',
      MAX_VENUES,
    );

    // Resolving the programme clock is a read per venue, so the directory is
    // capped above rather than paginated — a fan scanning a wall of rooms needs
    // the top of the list to be correct, not the whole catalogue at once.
    const cards = await Promise.all(
      (venues || []).map(async (venue) => {
        let state = null;
        try {
          state = await resolveVenueIdleState(base44, venue);
        } catch {
          // A broken programme must not remove the venue from the directory —
          // the room itself is still enterable.
          state = null;
        }
        return {
          id: venue.id,
          name: venue.name,
          description: venue.description || '',
          cover_image_url: venue.cover_image_url || '',
          room_id: venue.room_id || '',
          template_key: venue.template_key || '',
          is_live: !!state?.isLive,
          live_title: state?.isLive ? (state.liveSession?.title || '') : '',
          source: state?.source || '',
          channel_title: state?.playlist?.title || '',
          now_playing: state?.nowPlaying
            ? {
                title: state.nowPlaying.title || '',
                media_kind: state.nowPlaying.media_kind || 'audio',
                thumbnail_url: state.nowPlaying.thumbnail_url || '',
              }
            : null,
        };
      }),
    );

    // Live rooms first, then rooms with something actually on air.
    cards.sort((a, b) => {
      if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
      const aOn = a.now_playing ? 1 : 0;
      const bOn = b.now_playing ? 1 : 0;
      return bOn - aOn;
    });

    return Response.json({ venues: cards, server_time: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}