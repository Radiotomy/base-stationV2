// Switches an existing venue to a different performance preset.
//
// A Portals room's 3D world is fixed when the room is created — rewriting
// settings.roomBase afterwards is stored but ignored by the 3D client, which left
// fans in the old building with the new stage rig hanging in the wrong place.
// So a switch creates a FRESH room from the new template and points the venue at
// it. The fan link changes; the old room is left untouched.
//
// Carried over: venue name, description, cover art, the main screen's stream URL
// and the welcome panel / UI settings (re-pointed at the new room id).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveKeyForVenue, downloadRoomData, mergeRoomSettings, roomUrl } from '../../shared/portalsApi.ts';
import { getPreset, currentScreenUrl, VENUE_PRESETS } from '../../shared/venuePresets.ts';
import { createVenueRoom } from '../../shared/venueRoomSetup.ts';

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

    const preset = getPreset(templateKey);
    const { key } = await resolveKeyForVenue(base44, venue);
    const oldRoomId = venue.room_id;

    // Best-effort read of the old room — a sleeping room must not block the switch.
    let screenUrl = null;
    let extraSettings = '';
    if (oldRoomId) {
      try {
        const old = await downloadRoomData(oldRoomId, key);
        screenUrl = currentScreenUrl(old.roomItems);
        extraSettings = (old.settings?.roomSettingsExtraData || '').split(oldRoomId).join('__NEW_ROOM__');
      } catch (err) {
        console.warn('Old room unreadable, switching without carry-over:', err.message);
      }
    }

    const roomId = await createVenueRoom(key, preset, {
      name: venue.name,
      description: venue.description,
      coverImageUrl: venue.cover_image_url,
      screenUrl,
      extraSettings: '',
    });

    // If the old room was asleep, its welcome config could not be read — rebuild
    // it from the venue record so the in-world panel ("i" button) is never lost.
    if (!extraSettings && venue.welcome_embed_enabled) {
      extraSettings = JSON.stringify({
        welcomeEmbed: `https://basestation.live/venue-panel?roomId=__NEW_ROOM__&name=${encodeURIComponent(venue.name)}`,
        showWelcomeOnEntry: true,
        addWelcomeIframeToInfoButton: true,
      });
    }

    // The welcome panel URL names the room, so it can only be written once the
    // new id exists.
    if (extraSettings) {
      try {
        await mergeRoomSettings(roomId, key, {}, JSON.parse(extraSettings.split('__NEW_ROOM__').join(roomId)));
      } catch (err) {
        console.warn('Welcome settings carry-over failed:', err.message);
      }
    }

    await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
      room_id: roomId,
      template_key: preset.key,
      status: 'ready',
      last_published_at: new Date().toISOString(),
      idle_now_playing: {},
      idle_last_pushed_at: null,
      settings_snapshot: { ...(venue.settings_snapshot || {}), previous_room_id: oldRoomId },
    });

    return Response.json({
      ok: true,
      templateKey: preset.key,
      roomId,
      previousRoomId: oldRoomId,
      fanUrl: roomUrl(roomId),
      screenPreserved: !!screenUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}