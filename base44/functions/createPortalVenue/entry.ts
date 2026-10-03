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
import { resolveAccessKey, roomUrl } from '../../shared/portalsApi.ts';
import { getPreset, DEFAULT_PRESET_KEY } from '../../shared/venuePresets.ts';
import { createVenueRoom } from '../../shared/venueRoomSetup.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = (body.name || '').trim();
    const preset = getPreset(body.templateKey || DEFAULT_PRESET_KEY);
    const coverImageUrl = body.coverImageUrl || '';
    const loadingImageUrl = body.loadingImageUrl || '';
    const description = (body.description || '').slice(0, 1000);

    if (!name) return Response.json({ error: 'Venue name required' }, { status: 400 });
    if (coverImageUrl && !coverImageUrl.startsWith('https://')) {
      return Response.json({ error: 'Cover image must be an https URL' }, { status: 400 });
    }
    if (loadingImageUrl && !loadingImageUrl.startsWith('https://')) {
      return Response.json({ error: 'Loading screen image must be an https URL' }, { status: 400 });
    }

    const { key, ownership } = await resolveAccessKey(base44, user.id);

    // Rooms provisioned on the platform Portals account consume a shared quota,
    // so an unbounded create endpoint is a cost/abuse surface rather than a
    // feature. Creator-owned rooms spend the creator's own quota and are exempt.
    if (ownership === 'platform' && user.role !== 'admin') {
      const mine = await base44.asServiceRole.entities.PortalVenue.filter({
        user_id: user.id,
        ownership: 'platform',
      });
      const active = mine.filter((v) => v.status !== 'archived' && v.status !== 'failed');
      if (active.length >= 5) {
        return Response.json(
          { error: 'You have reached the limit of 5 venues. Archive one, or connect your own Portals key for unlimited venues.' },
          { status: 429 },
        );
      }
    }

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
      roomId = await createVenueRoom(key, preset, { name, description, coverImageUrl, loadingImageUrl });
    } catch (err) {
      await base44.asServiceRole.entities.PortalVenue.update(venue.id, {
        status: 'failed',
        error_message: err.message,
      });
      return Response.json({ error: err.message, venueId: venue.id }, { status: 502 });
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