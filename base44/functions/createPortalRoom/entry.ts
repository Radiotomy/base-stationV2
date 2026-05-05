import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PORTAL_KEY = Deno.env.get('PORTAL_ACCESS_KEY');
const PORTAL_BASE = 'https://theportal.to/api/v2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, title, coverImageUrl } = await req.json();
    if (!sessionId || !title) return Response.json({ error: 'sessionId and title required' }, { status: 400 });

    if (!PORTAL_KEY) return Response.json({ error: 'PORTAL_ACCESS_KEY not set' }, { status: 500 });

    // 1. Create a blank room
    const createRes = await fetch(`${PORTAL_BASE}/rooms/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-access-key': PORTAL_KEY },
      body: JSON.stringify({ templateName: 'blank', customTemplateName: title }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      return Response.json({ error: `Portal create failed: ${err}` }, { status: 502 });
    }
    const { roomId } = await createRes.json();

    // 2. Download existing room data
    const dlRes = await fetch(`${PORTAL_BASE}/mcp/download-room-data`, {
      headers: { 'x-room-id': roomId, 'x-access-key': PORTAL_KEY },
    });
    const roomData = dlRes.ok ? await dlRes.json() : { roomItems: {}, logic: {} };

    // 3. Build stage layout: a platform + cover art image screen + title text
    const stageItems = {
      ...(roomData.roomItems || {}),
      "100": {
        prefabName: "ResizableCube",
        pos: { x: 0, y: 0.05, z: -5 },
        rot: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 20, y: 0.1, z: 10 },
        modelsize: { x: 0, y: 0, z: 0 },
        modelCenter: { x: 0, y: 0, z: 0 },
        contentString: "",
        parentItemID: 0,
        placed: true,
        locked: false,
        superLocked: false,
        interactivityType: 0,
        interactivityURL: "",
        hoverTitle: "",
        hoverBodyContent: "",
        ImageInteractivityDetails: { buttonText: "", buttonURL: "" },
        sessionData: "",
        instanceId: "",
        currentEditornetId: 0,
      },
    };

    // Add cover art screen if URL provided
    if (coverImageUrl) {
      stageItems["101"] = {
        prefabName: "DefaultImage",
        pos: { x: 0, y: 3, z: -9.9 },
        rot: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 6, y: 6, z: 1 },
        modelsize: { x: 0, y: 0, z: 0 },
        modelCenter: { x: 0, y: 0, z: 0 },
        contentString: coverImageUrl,
        parentItemID: 0,
        placed: true,
        locked: false,
        superLocked: false,
        interactivityType: 0,
        interactivityURL: "",
        hoverTitle: title,
        hoverBodyContent: "Now Playing",
        ImageInteractivityDetails: { buttonText: "", buttonURL: "" },
        sessionData: "",
        instanceId: "",
        currentEditornetId: 0,
      };
    }

    const newRoomData = {
      ...roomData,
      roomItems: stageItems,
      logic: {
        ...(roomData.logic || {}),
        "100": JSON.stringify({ col: "1a1a2e", e: 0.4, s: true, Tasks: [], ViewNodes: [] }),
      },
    };

    // 4. Get signed upload URL
    const signRes = await fetch(`${PORTAL_BASE}/utils/generate-json-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PORTAL_KEY },
      body: JSON.stringify({ fileName: `room-${roomId}.json` }),
    });
    if (!signRes.ok) {
      // Room was created but data upload failed — still return roomId
      console.warn('Signed URL failed, returning bare room');
      return Response.json({ roomId, fanUrl: `https://theportal.to/?room=${roomId}` });
    }
    const { signedUploadURL, assetURL } = await signRes.json();

    // 5. PUT room data JSON to S3
    await fetch(signedUploadURL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoomData),
    });

    // 6. Tell Portal to load the new room data
    await fetch(`${PORTAL_BASE}/mcp/upload-room-data-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-room-id': roomId,
        'x-access-key': PORTAL_KEY,
      },
      body: JSON.stringify({ jsonUrl: assetURL }),
    });

    // 7. Persist roomId to the LiveSession entity
    await base44.asServiceRole.entities.LiveSession.update(sessionId, {
      portal_room_id: roomId,
    });

    return Response.json({
      roomId,
      fanUrl: `https://theportal.to/?room=${roomId}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});