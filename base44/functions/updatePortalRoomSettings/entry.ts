// Applies a BASE Station venue-design form to a Portals room's space options,
// and wires the in-world BASE Station panel (welcome iframe).
//
// Two things make this safe to call repeatedly:
//   1. Only a whitelisted set of space options can be written. A pass-through of
//      arbitrary keys would let a client reach settings that govern billing,
//      ownership or moderation on the creator's Portals account.
//   2. The previous values are snapshotted onto the venue BEFORE the write, so a
//      creator can revert a design change from BASE Station.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveKeyForVenue, setRoomSettings, roomUrl } from '../../shared/portalsApi.ts';

// BASE Station form field -> Portals settings path.
const SETTING_MAP = {
  name: 'Name',
  description: 'Description',
  coverImageUrl: 'Image',
  voiceChat: 'settings.voiceChat',
  movementMode: 'settings.movementMode',
  cameraMode: 'settings.cameraMode',
  weapons: 'settings.weapons',
  avatarLoad: 'settings.avatarLoad',
  passwordProtect: 'settings.passwordProtect',
  password: 'settings.password',
  welcomeEmbed: 'settings.welcomeEmbed',
  showWelcomeOnEntry: 'settings.showWelcomeOnEntry',
  addWelcomeIframeToInfoButton: 'settings.addWelcomeIframeToInfoButton',
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { venueId, settings = {} } = body;
    if (!venueId) return Response.json({ error: 'venueId required' }, { status: 400 });

    const venues = await base44.asServiceRole.entities.PortalVenue.filter({ id: venueId });
    const venue = venues?.[0];
    if (!venue) return Response.json({ error: 'Venue not found' }, { status: 404 });
    if (venue.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!venue.room_id) return Response.json({ error: 'This venue has no 3D room yet' }, { status: 400 });

    // Build the patch from whitelisted fields only.
    const patch = {};
    const applied = {};
    for (const [field, portalPath] of Object.entries(SETTING_MAP)) {
      if (settings[field] === undefined) continue;
      let value = settings[field];
      // Any URL we hand Portals must be https — a http or relative value is
      // dropped by the client and looks like a broken feature.
      if ((field === 'coverImageUrl' || field === 'welcomeEmbed') && value && !String(value).startsWith('https://')) {
        return Response.json({ error: `${field} must be an https URL` }, { status: 400 });
      }
      if (field === 'coverImageUrl') {
        patch['room.LoadingImages'] = [value];
      }
      patch[portalPath] = value;
      applied[field] = value;
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No supported settings provided' }, { status: 400 });
    }

    const { key } = await resolveKeyForVenue(base44, venue);

    // Snapshot BEFORE the write so a revert has something to restore.
    await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
      settings_snapshot: venue.settings_snapshot ? { ...venue.settings_snapshot, ...applied } : applied,
    });

    await setRoomSettings(venue.room_id, key, patch);

    const venuePatch = { last_published_at: new Date().toISOString() };
    if (applied.name) venuePatch.name = applied.name;
    if (applied.description !== undefined) venuePatch.description = applied.description;
    if (applied.coverImageUrl) venuePatch.cover_image_url = applied.coverImageUrl;
    if (applied.welcomeEmbed !== undefined) venuePatch.welcome_embed_enabled = !!applied.welcomeEmbed;
    await base44.asServiceRole.entities.PortalVenue.update(venue.id, venuePatch);

    return Response.json({ ok: true, roomId: venue.room_id, fanUrl: roomUrl(venue.room_id), applied });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}