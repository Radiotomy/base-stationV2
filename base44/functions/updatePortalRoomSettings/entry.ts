// Applies a BASE Station venue-design form to a Portals room's space options,
// and wires the in-world BASE Station panel (welcome iframe).
//
// Settings are written through room data (download → merge → upload), which is
// the documented path for these fields. Two safeguards matter here:
//   1. Only whitelisted options can be written. Passing arbitrary keys through
//      would let a client reach settings governing access, token gating and
//      moderation on the creator's own Portals account.
//   2. The previous values are snapshotted onto the venue BEFORE the write, so a
//      design change can be reverted from BASE Station.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveKeyForVenue, mergeRoomSettings, roomUrl } from '../../shared/portalsApi.ts';

// Fields that live directly on settings.<key>
const TOP_LEVEL = {
  nightMode: 'isNight',
  globalVoice: 'globalSpeaking',
  chatDisabled: 'chatDisabled',
  stageMode: 'inTownHallMode',
  allCanBuild: 'allCanBuild',
  npcPrompt: 'roomPrompt',
  liveInteractionRefresh: 'tasksRefresh',
};

// Fields that live inside the roomSettingsExtraData JSON string
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
      // A non-https URL is silently dropped by the Portals client, which reads
      // as a broken feature rather than a rejected input.
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