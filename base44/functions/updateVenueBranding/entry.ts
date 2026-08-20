// Applies a creator's own branding to their venue's Portals room: the cover art
// fans see on the room card, and the loading-screen artwork shown while the 3D
// world streams in.
//
// This is display metadata, which lives on /room/update-room-settings — a
// different surface from the environment settings in room data, so it gets its
// own function rather than being folded into updatePortalRoomSettings.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveKeyForVenue, setRoomSettings, roomUrl } from '../../shared/portalsApi.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { venueId } = body;
    const coverImageUrl = (body.coverImageUrl || '').trim();
    const loadingImageUrl = (body.loadingImageUrl || '').trim();
    if (!venueId) return Response.json({ error: 'venueId required' }, { status: 400 });

    // Portals loads both as resources — a non-https value is dropped by its
    // client and reads as broken branding rather than as bad input.
    for (const [label, value] of [['Cover image', coverImageUrl], ['Loading screen image', loadingImageUrl]]) {
      if (value && !value.startsWith('https://')) {
        return Response.json({ error: `${label} must be an https URL` }, { status: 400 });
      }
    }

    const venues = await base44.asServiceRole.entities.PortalVenue.filter({ id: venueId });
    const venue = venues?.[0];
    if (!venue) return Response.json({ error: 'Venue not found' }, { status: 404 });
    if (venue.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!venue.room_id) return Response.json({ error: 'This venue has no 3D room yet' }, { status: 400 });

    const { key } = await resolveKeyForVenue(base44, venue);
    await setRoomSettings(venue.room_id, key, {
      ...(coverImageUrl && { Image: coverImageUrl }),
      // An empty array restores the Portals default splash, so clearing the field
      // is a real action rather than a no-op the creator cannot undo.
      LoadingImages: loadingImageUrl ? [loadingImageUrl] : [],
    });

    await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
      ...(coverImageUrl && { cover_image_url: coverImageUrl }),
      last_published_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, fanUrl: roomUrl(venue.room_id) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}