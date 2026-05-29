// composeVideoNextCut — Stitch arbitrary scenes (b-roll, video URLs, solids) into
// a single MP4 with an optional audio track via NextCut's /api-render endpoint.
//
// Payload:
//   {
//     scenes: [                                  // required, 1..N
//       { kind: "broll",  query: "city traffic", durationSeconds: 4 },
//       { kind: "video",  src: "https://...mp4", durationSeconds: 4 },
//       { kind: "solid",  color: "#000000",      durationSeconds: 2 },
//     ],
//     audioUrl?: string,                          // optional master audio mux
//     width?: number   (default 1080),
//     height?: number  (default 720),             // must be <= 1080 on Starter tier
//     fps?: number     (default 30),
//   }
//
// Returns: { video_url, render_id, cost_usd, duration_s, scene_count }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const NEXTCUT_API = Deno.env.get('NEXTCUT_API');

function buildScene(scene, startFrame, fps) {
  const dur = Math.max(1, scene.durationSeconds || 4);
  const endFrame = startFrame + Math.round(dur * fps);
  let layer;
  switch (scene.kind) {
    case 'broll':
      layer = { type: 'broll', props: { query: scene.query || 'abstract', source: 'pexels' } };
      break;
    case 'video':
      layer = { type: 'video', props: { src: scene.src } };
      break;
    case 'solid':
    default:
      layer = { type: 'solid', props: { color: scene.color || '#000000' } };
      break;
  }
  return { startFrame, endFrame, layers: [layer] };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!NEXTCUT_API) return Response.json({ error: 'NEXTCUT_API not configured' }, { status: 500 });

    const body = await req.json();
    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    if (scenes.length === 0) {
      return Response.json({ error: 'At least one scene is required' }, { status: 400 });
    }

    const width = body.width || 1080;
    const height = Math.min(body.height || 720, 1080); // Starter tier cap
    const fps = body.fps || 30;

    // Build sequential scene timeline
    let cursor = 0;
    const builtScenes = scenes.map((s) => {
      const built = buildScene(s, cursor, fps);
      cursor = built.endFrame;
      return built;
    });

    const totalFrames = cursor;
    const totalSeconds = totalFrames / fps;

    const payload = {
      scenes: builtScenes,
      width,
      height,
      fps,
    };
    if (body.audioUrl) {
      payload.audio = { src: body.audioUrl };
    }

    const t0 = Date.now();
    const res = await fetch('https://api.nextcut.io/api-render', {
      method: 'POST',
      headers: {
        'x-api-key': NEXTCUT_API,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const latency = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      return Response.json({
        error: 'NextCut render failed',
        status: res.status,
        detail: errText.slice(0, 800),
      }, { status: 502 });
    }

    const data = await res.json();
    if (!data.outputUrl) {
      return Response.json({ error: 'No outputUrl in NextCut response', response: data }, { status: 502 });
    }

    return Response.json({
      video_url: data.outputUrl,
      render_id: data.renderId,
      cost_usd: data.cost,
      duration_s: totalSeconds,
      scene_count: scenes.length,
      latency_ms: latency,
      provider: 'nextcut',
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack?.slice(0, 600) }, { status: 500 });
  }
});