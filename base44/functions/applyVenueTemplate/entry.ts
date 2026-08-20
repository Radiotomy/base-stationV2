// Switches an existing venue to a different performance preset.
//
// A Portals room's world can only be chosen at create time via /rooms/create —
// but the scene it produces is recorded in settings.roomBase, which IS writable
// through room data. So a switch rewrites roomBase + night mode in place instead
// of creating a new room: the artist keeps their room id, fan link, quests and
// anything they built themselves.
//
// Preserved on purpose (the preset changes the ENVIRONMENT only):
//   - venue name, description, cover image (display metadata, untouched here)
//   - the main screen's stream URL, re-hung at the new stage's position
//   - every item outside BASE Station's reserved rig id range

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveKeyForVenue, downloadRoomData, uploadRoomData, roomUrl } from '../../shared/portalsApi.ts';
import { getPreset, buildVenueRig, withoutRig, currentScreenUrl, VENUE_PRESETS } from '../../shared/venuePresets.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { venueId, templateKey } = await req.json().catch(() => ({}));
    if (!venueId) return Response.json({ error: 'venueId required' }, { status: 400 });
    if (!VENUE_PRESETS.some((p) => p.key === templateKey)) {
      return Response.json({ error: 'Unknown venue template' }, { status: 400 });
    }

    const venues = await base44.asServiceRole.entities.PortalVenue.filter({ id: venueId });
    const venue = venues?.[0];
    if (!venue) return Response.json({ error: 'Venue not found' }, { status: 404 });
    if (venue.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!venue.room_id) return Response.json({ error: 'This venue has no 3D room yet' }, { status: 400 });

    const preset = getPreset(templateKey);
    const { key } = await resolveKeyForVenue(base44, venue);

    const roomData = await downloadRoomData(venue.room_id, key);
    const screenUrl = currentScreenUrl(roomData.roomItems);
    const rig = buildVenueRig(preset, {
      name: venue.name,
      coverImageUrl: venue.cover_image_url,
      screenUrl,
    });

    await uploadRoomData(venue.room_id, key, {
      ...roomData,
      roomItems: { ...withoutRig(roomData.roomItems), ...rig.items },
      logic: { ...withoutRig(roomData.logic), ...rig.logic },
      settings: {
        ...(roomData.settings || {}),
        roomBase: preset.roomBase,
        isNight: preset.isNight,
      },
    });

    await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
      template_key: preset.key,
      last_published_at: new Date().toISOString(),
      settings_snapshot: {
        ...(venue.settings_snapshot || {}),
        roomBase: roomData.settings?.roomBase,
        isNight: roomData.settings?.isNight,
      },
    });

    return Response.json({
      ok: true,
      templateKey: preset.key,
      roomId: venue.room_id,
      fanUrl: roomUrl(venue.room_id),
      screenPreserved: !!screenUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}