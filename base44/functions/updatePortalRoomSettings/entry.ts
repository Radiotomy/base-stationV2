// Applies a BASE Station venue-design change to a Portals room, and wires the
// in-world BASE Station panel (welcome iframe).
//
// Environment settings do NOT live on /room/update-room-settings — that endpoint
// only carries display metadata (name, description, cover) and currently 500s on
// Portals' side. Real space options live inside room data, split across
// settings.<field> and the settings.roomSettingsExtraData JSON string, so this
// function goes through mergeRoomSettings (download → merge → upload).
//
// Two things make it safe to call repeatedly:
//   1. Only whitelisted options can be written. A pass-through of arbitrary keys
//      would let a client reach access, token-gating and moderation settings on
//      the creator's own Portals account.
//   2. mergeRoomSettings returns the prior values, which are snapshotted onto the
//      venue so a design change can be reverted from BASE Station.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveKeyForVenue, mergeRoomSettings, roomUrl } from '../../shared/portalsApi.ts';

// BASE Station field -> settings.<key> (top level of the room settings object)
const TOP_LEVEL = {
  nightMode: 'isNight',
  globalVoice: 'globalSpeaking',
  chatDisabled: 'chatDisabled',
  stageMode: 'inTownHallMode',
  allCanBuild: 'allCanBuild',
  npcPrompt: 'roomPrompt',
  audiusPlaylist: 'audiusPlaylist',
};

// BASE Station field -> key inside the roomSettingsExtraData JSON string
const EXTRA = {
  welcomeEmbed: 'welcomeEmbed',
  showWelcomeOnEntry: 'showWelcomeOnEntry',
  addWelcomeIframeToInfoButton: 'addWelcomeIframeToInfoButton',
  openWelcomeIframeInBackground: 'openWelcomeIframeInBackground',
  requireUsername: 'requireUsername',
  allowedUsers: 'allowedUsers',
  onboardingType: 'onboardingType',
  skyBoxDayTextureUrl: 'skyBoxDayTextureUrl',
  skyBoxNightTextureUrl: 'skyBoxNightTextureUrl',
};

// Anything Portals loads as a resource must be https — a http or relative value
// is dropped by the client and reads as a broken feature rather than bad input.
const HTTPS_FIELDS = ['welcomeEmbed', 'skyBoxDayTextureUrl', 'skyBoxNightTextureUrl'];

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

    const topLevel = {};
    const extra = {};
    const applied = {};

    for (const [field, portalKey] of Object.entries(TOP_LEVEL)) {
      if (settings[field] === undefined) continue;
      topLevel[portalKey] = settings[field];
      applied[field] = settings[field];
    }
    for (const [field, portalKey] of Object.entries(EXTRA)) {
      if (settings[field] === undefined) continue;
      const value = settings[field];
      if (HTTPS_FIELDS.includes(field) && value && !String(value).startsWith('https://')) {
        return Response.json({ error: `${field} must be an https URL` }, { status: 400 });
      }
      extra[portalKey] = value;
      applied[field] = value;
    }

    if (Object.keys(topLevel).length === 0 && Object.keys(extra).length === 0) {
      return Response.json({ error: 'No supported settings provided' }, { status: 400 });
    }

    const { key } = await resolveKeyForVenue(base44, venue);
    const previous = await mergeRoomSettings(venue.room_id, key, topLevel, extra);

    const venuePatch = {
      last_published_at: new Date().toISOString(),
      settings_snapshot: { ...(venue.settings_snapshot || {}), ...previous },
    };
    if (applied.welcomeEmbed !== undefined) venuePatch.welcome_embed_enabled = !!applied.welcomeEmbed;
    await base44.asServiceRole.entities.PortalVenue.update(venue.id, venuePatch);

    return Response.json({
      ok: true,
      roomId: venue.room_id,
      fanUrl: roomUrl(venue.room_id),
      applied,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}