// Creates a durable 3D venue for a creator: provisions a Portals room from a
// starter world, brands it, and records it as a PortalVenue.
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

// Item ids 100+ are BASE Station's reserved range inside a room.
function baseItem(prefabName, pos, scale, extra = {}) {
  return {
    prefabName,
    pos,
    rot: { x: 0, y: 0, z: 0, w: 1 },
    scale,
    modelsize: { x: 0, y: 0, z: 0 },
    modelCenter: { x: 0, y: 0, z: 0 },
    contentString: '',
    parentItemID: 0,
    placed: true,
    locked: false,
    superLocked: false,
    interactivityType: 0,
    interactivityURL: '',
    hoverTitle: '',
    hoverBodyContent: '',
    ImageInteractivityDetails: { buttonText: '', buttonURL: '' },
    sessionData: '',
    instanceId: '',
    currentEditornetId: 0,
    ...extra,
  };
}

function mat(col, e) {
  return JSON.stringify({ col, e, s: true, Tasks: [], ViewNodes: [] });
}

// Each starter world is a different physical room, not a recolour — the picker
// promises "club vs listening room vs festival stage" and the geometry has to
// deliver that or the choice is cosmetic.
function buildWorld(templateKey, { name, coverImageUrl }) {
  const items = {};
  const logic = {};

  if (templateKey === 'blank') return { items, logic };

  if (templateKey === 'listening_room') {
    items['100'] = baseItem('ResizableCube', { x: 0, y: 0.05, z: 0 }, { x: 16, y: 0.1, z: 16 });
    logic['100'] = mat('241c14', 0.2);
    items['102'] = baseItem('ResizableCube', { x: 0, y: 0.2, z: -5 }, { x: 6, y: 0.4, z: 3 });
    logic['102'] = mat('1a140e', 0.3);
    // Seating ring, facing the playback wall
    const seats = [-3, -1, 1, 3];
    seats.forEach((x, i) => {
      const id = String(120 + i);
      items[id] = baseItem('ResizableCube', { x, y: 0.3, z: 3 }, { x: 0.9, y: 0.6, z: 0.9 });
      logic[id] = mat('3a2a1c', 0.15);
    });
    if (coverImageUrl) {
      items['101'] = baseItem('DefaultImage', { x: 0, y: 3, z: -6.8 }, { x: 5, y: 5, z: 1 }, {
        contentString: coverImageUrl, hoverTitle: name, hoverBodyContent: 'Now Playing',
      });
    }
    return { items, logic };
  }

  if (templateKey === 'festival_stage') {
    items['100'] = baseItem('ResizableCube', { x: 0, y: 0.05, z: 6 }, { x: 70, y: 0.1, z: 60 });
    logic['100'] = mat('14100c', 0.25);
    items['102'] = baseItem('ResizableCube', { x: 0, y: 1, z: -14 }, { x: 26, y: 2, z: 10 });
    logic['102'] = mat('0e0b08', 0.4);
    // Towers flanking the mainstage
    [-15, 15].forEach((x, i) => {
      const id = String(130 + i);
      items[id] = baseItem('ResizableCube', { x, y: 6, z: -13 }, { x: 1.5, y: 12, z: 1.5 });
      logic[id] = mat('241c14', 0.3);
    });
    if (coverImageUrl) {
      items['101'] = baseItem('DefaultImage', { x: 0, y: 10, z: -19 }, { x: 20, y: 12, z: 1 }, {
        contentString: coverImageUrl, hoverTitle: name, hoverBodyContent: 'Now Playing',
      });
    }
    return { items, logic };
  }

  // club (default)
  items['100'] = baseItem('ResizableCube', { x: 0, y: 0.05, z: 2 }, { x: 44, y: 0.1, z: 36 });
  logic['100'] = mat('14100c', 0.35);
  items['102'] = baseItem('ResizableCube', { x: 0, y: 0.35, z: -8 }, { x: 14, y: 0.7, z: 6 });
  logic['102'] = mat('1a1a2e', 0.5);
  items['110'] = baseItem('ResizableCube', { x: 0, y: 0.55, z: 15 }, { x: 12, y: 1.1, z: 1 }, {
    hoverTitle: 'The BASE Bar', hoverBodyContent: 'Grab a seat and enjoy the show',
  });
  logic['110'] = mat('3a2a1c', 0.2);
  items['111'] = baseItem('ResizableCube', { x: 0, y: 1.14, z: 15 }, { x: 12.6, y: 0.08, z: 1.4 });
  logic['111'] = mat('0e0b08', 0.6);
  items['112'] = baseItem('ResizableCube', { x: 0, y: 1.6, z: 17.4 }, { x: 12, y: 3.2, z: 0.3 });
  logic['112'] = mat('1a140e', 0.15);
  items['113'] = baseItem('ResizableCube', { x: 0, y: 1.9, z: 17.1 }, { x: 11, y: 0.06, z: 0.5 });
  logic['113'] = mat('ff9a4d', 1.2);
  items['114'] = baseItem('ResizableCube', { x: 0, y: 2.5, z: 17.1 }, { x: 11, y: 0.06, z: 0.5 });
  logic['114'] = mat('ff9a4d', 1.2);
  [-4.5, -1.5, 1.5, 4.5].forEach((x, i) => {
    const id = String(115 + i);
    items[id] = baseItem('ResizableCube', { x, y: 0.35, z: 13.6 }, { x: 0.5, y: 0.7, z: 0.5 });
    logic[id] = mat('241c14', 0.25);
  });
  if (coverImageUrl) {
    items['101'] = baseItem('DefaultImage', { x: 0, y: 5, z: -11.9 }, { x: 8, y: 8, z: 1 }, {
      contentString: coverImageUrl, hoverTitle: name, hoverBodyContent: 'Now Playing',
    });
    items['103'] = baseItem('DefaultImage', { x: -11, y: 3.5, z: -10 }, { x: 4.5, y: 4.5, z: 1 }, {
      contentString: coverImageUrl, hoverTitle: name, hoverBodyContent: 'Now Playing',
    });
    items['104'] = baseItem('DefaultImage', { x: 11, y: 3.5, z: -10 }, { x: 4.5, y: 4.5, z: 1 }, {
      contentString: coverImageUrl, hoverTitle: name, hoverBodyContent: 'Now Playing',
    });
  }
  return { items, logic };
}

const PORTAL_TEMPLATES = {
  club: 'blank',
  listening_room: 'blank',
  festival_stage: 'blank',
  blank: 'blank',
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = (body.name || '').trim();
    const templateKey = body.templateKey || 'club';
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
      template_key: templateKey,
      cover_image_url: coverImageUrl,
      ownership,
      status: 'creating',
    });

    let roomId;
    try {
      roomId = await createRoom(key, PORTAL_TEMPLATES[templateKey] || 'blank', name);
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
      });
    } catch (err) {
      console.warn('Venue settings failed:', err.message);
    }

    // Build the starter world on top of whatever the template shipped with.
    try {
      const roomData = await downloadRoomData(roomId, key);
      const world = buildWorld(templateKey, { name, coverImageUrl });
      await uploadRoomData(roomId, key, {
        ...roomData,
        roomItems: { ...(roomData.roomItems || {}), ...world.items },
        logic: { ...(roomData.logic || {}), ...world.logic },
      });
    } catch (err) {
      console.warn('World build failed (room still usable):', err.message);
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