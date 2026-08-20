// Writes a venue's AI NPC staff into its Portals room.
//
// Only the venue's owner (or an admin) may call this: an NPC carries a persona
// prompt that speaks to every fan in the artist's name, so the roster is not
// something a visitor gets to edit.
//
// A Portals upload REPLACES the whole room, so the merge here is narrow on
// purpose: the staff band (ids 120-139) is stripped and rewritten, and every
// other item — the stage rig, the audio carrier, anything the artist placed by
// hand in Portals — is carried through untouched.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveKeyForVenue, downloadRoomData, uploadRoomData } from '../../shared/portalsApi.ts';
import { getPreset } from '../../shared/venuePresets.ts';
import { buildVenueStaff, withoutStaff } from '../../shared/venueNpcs.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!body.venueId) return Response.json({ error: 'venueId is required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.PortalVenue.filter({ id: body.venueId });
    const venue = rows?.[0];
    if (!venue) return Response.json({ error: 'Venue not found' }, { status: 404 });
    if (venue.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!venue.room_id) return Response.json({ error: 'This venue has no 3D room yet' }, { status: 400 });

    // The caller may send a new roster (Save) or none at all (re-push what is
    // already stored, e.g. after a template switch moved the stage).
    const staff = Array.isArray(body.staff) ? body.staff : (venue.staff || []);
    if (Array.isArray(body.staff)) {
      await base44.asServiceRole.entities.PortalVenue.update(venue.id, { staff });
    }

    // Facts the characters are allowed to state. Read from the venue's own stored
    // programme snapshot — a character must never be briefed with anything the
    // venue cannot back up.
    const nowPlaying = venue.idle_now_playing || {};
    const facts = {
      venueName: venue.name || '',
      artistName: user.full_name || '',
      nowPlaying: nowPlaying.title || '',
      isLive: false,
    };

    const preset = getPreset(venue.template_key);
    const built = buildVenueStaff(preset, staff, facts);

    const resolved = await resolveKeyForVenue(base44, venue);
    const roomData = await downloadRoomData(venue.room_id, resolved.key);

    await uploadRoomData(venue.room_id, resolved.key, {
      ...roomData,
      roomItems: { ...withoutStaff(roomData.roomItems || {}), ...built.items },
      logic: { ...withoutStaff(roomData.logic || {}), ...built.logic },
    });

    await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
      staff_last_pushed_at: new Date().toISOString(),
    });

    return Response.json({ placed: Object.keys(built.items).length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}