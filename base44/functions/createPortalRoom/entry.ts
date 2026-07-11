// Portals (theportal.to) room manager for BASE Station Live Studio.
// Built against the documented Portals API (prtls.gitbook.io/portals-building-guide/api/api):
//   Auth:   x-access-key (rooms) / x-api-key (asset uploads) — same key
//   POST /api/v2/mcp/verify-access-key        — validate key
//   POST /api/v2/rooms/create                 — create room from template
//   POST /api/v2/room/update-room-settings    — name / description / image / loading screens
//   GET  /api/v2/mcp/download-room-data       — raw room JSON
//   POST /api/v2/utils/generate-json-upload-url + PUT → /api/v2/mcp/upload-room-data-url
//   Room URL: https://theportal.to/?room={roomId}
// Coordinate system: ground Y=0, up +Y, identity quaternion rotation.
//
// Actions (body.action):
//   "verify"            — check PORTAL_ACCESS_KEY validity → { configured, uid }
//   "create" (default)  — create a concert venue room for a LiveSession, build the
//                         stage (platform + main screen + side screens), set room
//                         settings, persist portal_room_id on the session
//   "update_now_playing"— push current track title + cover art onto the in-room
//                         screens + room settings so the 3D venue stays in sync
//   "set_screen_video"  — put an MP4/video on the big video wall above the stage
//                         (empty videoUrl clears it and restores the image screen)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PORTAL_KEY = Deno.env.get('PORTAL_ACCESS_KEY');
const PORTAL_BASE = 'https://theportal.to/api/v2';

function accessHeaders() {
  return { 'Content-Type': 'application/json', 'x-access-key': PORTAL_KEY };
}

// Base shape shared by all room items
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

// Concert venue layout: dance floor, raised stage, main backdrop screen,
// two side screens. Item IDs 100–105 are reserved for BASE Station.
// GLB/models face +Z; screens face the audience spawn area (+Z side).
function buildStageItems({ title, coverImageUrl }) {
  const items = {
    // Dance floor (enlarged venue)
    '100': baseItem('ResizableCube', { x: 0, y: 0.05, z: 2 }, { x: 44, y: 0.1, z: 36 }),
    // Raised performance stage
    '102': baseItem('ResizableCube', { x: 0, y: 0.35, z: -8 }, { x: 14, y: 0.7, z: 6 }),
    // ── Modern bar / saloon at the back of the room (+Z, opposite the stage) ──
    // Bar counter body
    '110': baseItem('ResizableCube', { x: 0, y: 0.55, z: 15 }, { x: 12, y: 1.1, z: 1 }, {
      hoverTitle: 'The BASE Bar', hoverBodyContent: 'Grab a seat and enjoy the show',
    }),
    // Polished counter top slab
    '111': baseItem('ResizableCube', { x: 0, y: 1.14, z: 15 }, { x: 12.6, y: 0.08, z: 1.4 }),
    // Back-bar shelf wall
    '112': baseItem('ResizableCube', { x: 0, y: 1.6, z: 17.4 }, { x: 12, y: 3.2, z: 0.3 }),
    // Glowing shelf boards
    '113': baseItem('ResizableCube', { x: 0, y: 1.9, z: 17.1 }, { x: 11, y: 0.06, z: 0.5 }),
    '114': baseItem('ResizableCube', { x: 0, y: 2.5, z: 17.1 }, { x: 11, y: 0.06, z: 0.5 }),
    // Bar stools
    '115': baseItem('ResizableCube', { x: -4.5, y: 0.35, z: 13.6 }, { x: 0.5, y: 0.7, z: 0.5 }),
    '116': baseItem('ResizableCube', { x: -1.5, y: 0.35, z: 13.6 }, { x: 0.5, y: 0.7, z: 0.5 }),
    '117': baseItem('ResizableCube', { x: 1.5, y: 0.35, z: 13.6 }, { x: 0.5, y: 0.7, z: 0.5 }),
    '118': baseItem('ResizableCube', { x: 4.5, y: 0.35, z: 13.6 }, { x: 0.5, y: 0.7, z: 0.5 }),
  };
  if (coverImageUrl) {
    // Main backdrop screen — now playing cover art
    items['101'] = baseItem('DefaultImage', { x: 0, y: 5, z: -11.9 }, { x: 8, y: 8, z: 1 }, {
      contentString: coverImageUrl,
      hoverTitle: title,
      hoverBodyContent: 'Now Playing',
    });
    // Side screens
    items['103'] = baseItem('DefaultImage', { x: -11, y: 3.5, z: -10 }, { x: 4.5, y: 4.5, z: 1 }, {
      contentString: coverImageUrl, hoverTitle: title, hoverBodyContent: 'Now Playing',
    });
    items['104'] = baseItem('DefaultImage', { x: 11, y: 3.5, z: -10 }, { x: 4.5, y: 4.5, z: 1 }, {
      contentString: coverImageUrl, hoverTitle: title, hoverBodyContent: 'Now Playing',
    });
  }
  return items;
}

// Upload room JSON: signed URL → PUT → tell Portals to load it
async function uploadRoomData(roomId, roomData) {
  const signRes = await fetch(`${PORTAL_BASE}/utils/generate-json-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': PORTAL_KEY },
    body: JSON.stringify({ fileName: `basestation-room-${roomId}-${Date.now()}.json` }),
  });
  if (!signRes.ok) throw new Error(`Signed URL failed: ${await signRes.text()}`);
  const { signedUploadURL, assetURL } = await signRes.json();

  const putRes = await fetch(signedUploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(roomData),
  });
  if (!putRes.ok) throw new Error(`Room JSON PUT failed: HTTP ${putRes.status}`);

  const loadRes = await fetch(`${PORTAL_BASE}/mcp/upload-room-data-url`, {
    method: 'POST',
    headers: { ...accessHeaders(), 'x-room-id': roomId },
    body: JSON.stringify({ jsonUrl: assetURL }),
  });
  if (!loadRes.ok) throw new Error(`Room data load failed: ${await loadRes.text()}`);
}

async function downloadRoomData(roomId) {
  const res = await fetch(`${PORTAL_BASE}/mcp/download-room-data`, {
    headers: { 'x-room-id': roomId, 'x-access-key': PORTAL_KEY },
  });
  if (!res.ok) return { roomItems: {}, settings: {}, roomTasks: { Tasks: [] }, quests: {}, logic: {} };
  try { return await res.json(); } catch { return { roomItems: {}, settings: {}, roomTasks: { Tasks: [] }, quests: {}, logic: {} }; }
}

async function updateRoomSettings(roomId, { name, description, image }) {
  await fetch(`${PORTAL_BASE}/room/update-room-settings`, {
    method: 'POST',
    headers: accessHeaders(),
    body: JSON.stringify({
      RoomID: roomId,
      ...(name && { Name: name }),
      ...(description && { Description: description }),
      ...(image && { Image: image, 'room.LoadingImages': [image] }),
    }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'create';

    if (!PORTAL_KEY) return Response.json({ configured: false, error: 'PORTAL_ACCESS_KEY not set' }, { status: action === 'verify' ? 200 : 500 });

    // ── verify — access key health check ────────────────────────────────────
    if (action === 'verify') {
      const res = await fetch(`${PORTAL_BASE}/mcp/verify-access-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: PORTAL_KEY }),
      });
      if (!res.ok) return Response.json({ configured: false, error: `Key invalid: HTTP ${res.status}` });
      const data = await res.json();
      return Response.json({ configured: true, uid: data?.data?.uid || null });
    }

    // ── update_now_playing — sync track title + cover to in-room screens ────
    if (action === 'update_now_playing') {
      const { sessionId, trackTitle, coverImageUrl } = body;
      if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
      const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
      const session = sessions[0];
      if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
      if (session.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const roomId = session.portal_room_id;
      if (!roomId) return Response.json({ error: 'No Portals room on this session' }, { status: 400 });

      const roomData = await downloadRoomData(roomId);
      const items = { ...(roomData.roomItems || {}) };
      const screenIds = ['101', '103', '104'];
      for (const id of screenIds) {
        if (coverImageUrl) {
          // Create or update the screen items with the new cover
          items[id] = items[id]
            ? { ...items[id], contentString: coverImageUrl, hoverTitle: trackTitle || items[id].hoverTitle, hoverBodyContent: 'Now Playing' }
            : buildStageItems({ title: trackTitle || 'Now Playing', coverImageUrl })[id];
        } else if (items[id] && trackTitle) {
          items[id] = { ...items[id], hoverTitle: trackTitle };
        }
      }
      await uploadRoomData(roomId, { ...roomData, roomItems: items });
      if (coverImageUrl) await updateRoomSettings(roomId, { image: coverImageUrl });

      return Response.json({ ok: true, roomId, fanUrl: `https://theportal.to/?room=${roomId}` });
    }

    // ── set_screen_video — MP4/video performance on the stage video wall ────
    if (action === 'set_screen_video') {
      const { sessionId, videoUrl, videoTitle } = body;
      if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
      const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
      const session = sessions[0];
      if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
      if (session.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const roomId = session.portal_room_id;
      if (!roomId) return Response.json({ error: 'No Portals room on this session' }, { status: 400 });

      const roomData = await downloadRoomData(roomId);
      const items = { ...(roomData.roomItems || {}) };

      if (videoUrl) {
        // Big video wall — replaces the main backdrop image while active (id 105)
        items['105'] = baseItem('DefaultVideo', { x: 0, y: 5, z: -11.8 }, { x: 14, y: 8, z: 1 }, {
          contentString: videoUrl,
          hoverTitle: videoTitle || 'Live Video',
          hoverBodyContent: 'Now Showing',
        });
        // Hide the static image backdrop behind the video wall while video plays
        if (items['101']) items['101'] = { ...items['101'], pos: { ...items['101'].pos, y: -50 } };
      } else {
        // Clear video wall, restore the image backdrop
        delete items['105'];
        if (items['101']) items['101'] = { ...items['101'], pos: { ...items['101'].pos, y: 5 } };
      }

      await uploadRoomData(roomId, { ...roomData, roomItems: items });
      return Response.json({ ok: true, roomId, videoActive: !!videoUrl });
    }

    // ── create (default) — build the live venue room ─────────────────────────
    const { sessionId, title, coverImageUrl, templateName, description } = body;
    if (!sessionId || !title) return Response.json({ error: 'sessionId and title required' }, { status: 400 });

    const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
    const session = sessions[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    if (session.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Reuse an existing room on this session instead of creating duplicates
    if (session.portal_room_id) {
      return Response.json({
        roomId: session.portal_room_id,
        fanUrl: `https://theportal.to/?room=${session.portal_room_id}`,
        reused: true,
      });
    }

    // 1. Create room from template
    const createRes = await fetch(`${PORTAL_BASE}/rooms/create`, {
      method: 'POST',
      headers: accessHeaders(),
      body: JSON.stringify({ templateName: templateName || 'blank', customTemplateName: title.slice(0, 60) }),
    });
    if (!createRes.ok) {
      return Response.json({ error: `Portals room create failed: ${await createRes.text()}` }, { status: 502 });
    }
    const { roomId } = await createRes.json();
    if (!roomId) return Response.json({ error: 'No roomId returned from Portals' }, { status: 502 });

    // 2. Room settings — name, description, cover as loading screen image
    await updateRoomSettings(roomId, {
      name: title.slice(0, 60),
      description: description || `Live performance on BASE Station — ${title}`,
      image: coverImageUrl || undefined,
    });

    // 3. Build the concert stage on top of the template's existing content
    try {
      const roomData = await downloadRoomData(roomId);
      const stageItems = { ...(roomData.roomItems || {}), ...buildStageItems({ title, coverImageUrl }) };
      const newRoomData = {
        ...roomData,
        roomItems: stageItems,
        logic: {
          ...(roomData.logic || {}),
          '100': JSON.stringify({ col: '14100c', e: 0.35, s: true, Tasks: [], ViewNodes: [] }),
          '102': JSON.stringify({ col: '1a1a2e', e: 0.5, s: true, Tasks: [], ViewNodes: [] }),
          // Bar/saloon — warm walnut counter, glossy top, dark back wall, amber-glow shelves, dark stools
          '110': JSON.stringify({ col: '3a2a1c', e: 0.2, s: true, Tasks: [], ViewNodes: [] }),
          '111': JSON.stringify({ col: '0e0b08', e: 0.6, s: true, Tasks: [], ViewNodes: [] }),
          '112': JSON.stringify({ col: '1a140e', e: 0.15, s: true, Tasks: [], ViewNodes: [] }),
          '113': JSON.stringify({ col: 'ff9a4d', e: 1.2, s: true, Tasks: [], ViewNodes: [] }),
          '114': JSON.stringify({ col: 'ff9a4d', e: 1.2, s: true, Tasks: [], ViewNodes: [] }),
          '115': JSON.stringify({ col: '241c14', e: 0.25, s: true, Tasks: [], ViewNodes: [] }),
          '116': JSON.stringify({ col: '241c14', e: 0.25, s: true, Tasks: [], ViewNodes: [] }),
          '117': JSON.stringify({ col: '241c14', e: 0.25, s: true, Tasks: [], ViewNodes: [] }),
          '118': JSON.stringify({ col: '241c14', e: 0.25, s: true, Tasks: [], ViewNodes: [] }),
        },
      };
      await uploadRoomData(roomId, newRoomData);
    } catch (stageErr) {
      // Room exists — stage build is best-effort, don't fail the whole flow
      console.warn('Stage build failed (room still usable):', stageErr.message);
    }

    // 4. Persist to the LiveSession
    await base44.asServiceRole.entities.LiveSession.update(sessionId, {
      portal_room_id: roomId,
      portals_enabled: true,
      portals_scene: 'club',
    });

    return Response.json({
      roomId,
      fanUrl: `https://theportal.to/?room=${roomId}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});