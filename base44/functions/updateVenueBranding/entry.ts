// Applies a creator's own branding to their venue's Portals room: the cover art
// fans see on the room card, and the loading-screen artwork shown while the 3D
// world streams in.
//
// This is display metadata, which lives on /room/update-room-settings — a
// different surface from the environment settings in room data, so it gets its
// own function rather than being folded into updatePortalRoomSettings.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveKeyForVenue, setRoomSettings, roomUrl, downloadRoomData, uploadRoomData } from '../../shared/portalsApi.ts';
import { getPreset, buildIdleScreen } from '../../shared/venuePresets.ts';

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

    void loadingImageUrl; // Portals ignores LoadingImages via the API — set it in the Portals builder.
    if (!coverImageUrl) return Response.json({ error: 'Cover image required' }, { status: 400 });

    const { key } = await resolveKeyForVenue(base44, venue);
    // `Image` is the room card / directory art.
    await setRoomSettings(venue.room_id, key, { Image: coverImageUrl });

    // The in-world stage wall is a separate placed item, so the new cover must
    // also be hung there — otherwise fans inside the room still see the old art.
    // Skipped while idle programming owns the wall (it shows track artwork).
    let wallUpdated = false;
    if (!venue.idle_now_playing?.asset_id) {
      try {
        const roomData = await downloadRoomData(venue.room_id, key);
        const screen = roomData.roomItems?.['105'];
        if (!screen || screen.prefabName === 'DefaultPainting') {
          const wall = buildIdleScreen(getPreset(venue.template_key), {
            url: coverImageUrl, kind: 'audio', title: venue.name, subtitle: 'BASE Station venue',
          });
          await uploadRoomData(venue.room_id, key, {
            ...roomData,
            roomItems: { ...(roomData.roomItems || {}), ...wall.items },
          });
          wallUpdated = true;
        }
      } catch (err) {
        console.warn('Stage wall cover refresh skipped:', err.message);
      }
    }

    await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
      ...(coverImageUrl && { cover_image_url: coverImageUrl }),
      last_published_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, wallUpdated, fanUrl: roomUrl(venue.room_id) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}