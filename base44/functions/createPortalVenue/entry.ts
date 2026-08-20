// Creates a durable 3D venue for a creator: provisions a Portals room from one
// of the 8 BASE Station performance presets, brands it, hangs the stage rig, and
// records it as a PortalVenue.
//
// A venue is deliberately NOT tied to a LiveSession — it is a reusable place, so
// the 3D world is built once and every future show reuses it rather than
// rebuilding a room per performance.
//
// Ownership is resolved server-side: a creator with a connected Portals key gets
// a room owned by their own wallet, everyone else gets one under the platform
// account so no Portals account is required to go live.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  resolveAccessKey,
  createRoom,
  setRoomSettings,
  downloadRoomData,
  uploadRoomData,
  roomUrl,
} from '../../shared/portalsApi.ts';
import { getPreset, buildVenueRig, DEFAULT_PRESET_KEY } from '../../shared/venuePresets.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = (body.name || '').trim();
    const preset = getPreset(body.templateKey || DEFAULT_PRESET_KEY);
    const coverImageUrl = body.coverImageUrl || '';
    const description = (body.description || '').slice(0, 1000);

    if (!name) return Response.json({ error: 'Venue name required' }, { status: 400 });
    if (coverImageUrl && !coverImageUrl.startsWith('https://')) {
      return Response.json({ error: 'Cover image must be an https URL' }, { status: 400 });
    }

    const { key, ownership } = await resolveAccessKey(base44, user.id);

    // Record the venue up front so a Portals failure leaves a visible row the
    // creator can read, rather than a silent no-op.
    const venue = await base44.asServiceRole.entities.PortalVenue.create({
      user_id: user.id,
      user_email: user.email,
      name: name.slice(0, 80),
      description,
      template_key: preset.key,
      cover_image_url: coverImageUrl,
      ownership,
      status: 'creating',
    });

    let roomId;
    try {
      roomId = await createRoom(key, preset.portalTemplate, name);
    } catch (err) {
      await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
        status: 'failed',
        error_message: err.message,
      });
      return Response.json({ error: err.message, venueId: venue.id }, { status: 502 });
    }

    // Branding. Best-effort: the room already exists and is usable, so a
    // settings hiccup must not fail the whole venue.
    // LoadingImages is documented but silently ignored by Portals (it always
    // reads back empty), so the cover only drives Image — claiming a custom
    // loading screen we cannot actually set would be a lie on the venue card.
    try {
      await setRoomSettings(roomId, key, {
        Name: name.slice(0, 60),
        Description: description || `A BASE Station live venue — ${name}`,
        ...(coverImageUrl && { Image: coverImageUrl }),
        // A new room starts unpublished, which is what makes fans hit "this space
        // is private". Publishing requires a non-empty ShortDescription, so it is
        // sent in the same patch rather than left to a later call.
        ShortDescription: `${name} — a BASE Station live music venue.`.slice(0, 160),
        Status: 'Published',
        ShowOnDirectory: true,
      });
    } catch (err) {
      console.warn('Venue settings failed:', err.message);
    }

    // Hang the preset's lighting rig and stage screen on top of the template's
    // own geometry, and set its day/night mode.
    try {
      const roomData = await downloadRoomData(roomId, key);
      const rig = buildVenueRig(preset, { name, coverImageUrl });
      // A freshly created room carries an EMPTY roomSettingsExtraData string, so
      // no access value is stored at all. Write allowedUsers: 0 ("anyone") so the
      // venue is explicitly open to fans instead of relying on an unset default.
      let extra: Record<string, unknown> = {};
      const raw = roomData?.settings?.roomSettingsExtraData;
      if (typeof raw === 'string' && raw) { try { extra = JSON.parse(raw); } catch { extra = {}; } }
      await uploadRoomData(roomId, key, {
        ...roomData,
        roomItems: { ...(roomData.roomItems || {}), ...rig.items },
        logic: { ...(roomData.logic || {}), ...rig.logic },
        settings: {
          ...(roomData.settings || {}),
          isNight: preset.isNight,
          onlyNftHolders: false,
          roomSettingsExtraData: JSON.stringify({ ...extra, allowedUsers: 0 }),
        },
      });
    } catch (err) {
      console.warn('Stage rig build failed (room still usable):', err.message);
    }

    await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
      room_id: roomId,
      status: 'ready',
      last_published_at: new Date().toISOString(),
    });

    return Response.json({
      venueId: venue.id,
      roomId,
      ownership,
      fanUrl: roomUrl(roomId),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}