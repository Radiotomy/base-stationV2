// composeVideoShotstack — stitches storyboard scenes (Pexels b-roll, video URLs,
// solid colors) into a single MP4 with an optional soundtrack via the Shotstack
// Edit API. Replaces the retired NextCut integration.
//
// Renders are asynchronous: this returns a job_id immediately; pollGenerationJob
// finalizes the job (persists the MP4, deducts credits, saves to the library).
//
// Credits: 5 base + 1 per scene + 3 if audio attached — charged on success only.
//
// Payload:
//   {
//     scenes: [
//       { kind: "broll", query: "city traffic", durationSeconds: 4, transitionOut?, text? },
//       { kind: "video", src: "https://...mp4", durationSeconds: 4 },
//       { kind: "solid", color: "#000000", durationSeconds: 2 },
//     ],
//     audioUrl?: string,
//     width?: number (default 1920), height?: number (default 1080), fps?: number (default 30)
//   }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildEdit, submitRender, resolvePexelsClip } from '../../shared/shotstack.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    if (scenes.length === 0) {
      return Response.json({ error: 'At least one scene is required' }, { status: 400 });
    }

    const hasAudio = !!body.audioUrl;
    const captions = body.captions?.enabled && hasAudio
      ? { enabled: true, style: body.captions.style === 'clean' ? 'clean' : 'karaoke' }
      : null;
    const cost = 5 + scenes.length + (hasAudio ? 3 : 0) + (captions ? 4 : 0);

    const creditRows = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = creditRows[0]?.balance ?? 0;
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits',
        required: cost, balance,
        message: `This music video costs ${cost} credits (5 base + ${scenes.length} scenes${hasAudio ? ' + 3 audio mux' : ''}${captions ? ' + 4 auto-captions' : ''}). You have ${balance}.`,
      }, { status: 402 });
    }

    const width = body.width || 1920;
    const height = body.height || 1080;
    const fps = body.fps || 30;
    const orientation = height > width ? 'portrait' : width === height ? 'square' : 'landscape';

    // Resolve b-roll queries into concrete Pexels video sources
    const attribution = [];
    const resolved = [];
    for (const scene of scenes) {
      if (scene.kind === 'broll') {
        const hit = await resolvePexelsClip(scene.query, orientation);
        if (!hit) {
          resolved.push({ ...scene, kind: 'solid', color: '#111111' });
          continue;
        }
        if (hit.photographer) attribution.push({ photographer: hit.photographer, url: hit.photographer_url });
        resolved.push({ ...scene, src: hit.src });
      } else {
        resolved.push(scene);
      }
    }

    const { edit, totalSeconds } = buildEdit(resolved, {
      width, height, fps,
      audioUrl: body.audioUrl,
      captions,
    });

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'video', provider: 'shotstack',
      status: 'processing',
      input_data: {
        scene_count: scenes.length,
        scenes: scenes.map(s => ({ kind: s.kind, query: s.query, duration: s.durationSeconds, text: s.text, text_animation: s.textAnimation })),
        has_audio: hasAudio,
        captions: captions || undefined,
        width, height, fps,
        duration: totalSeconds,
        attribution,
        credit_cost: cost,
      },
      started_at: new Date().toISOString(),
    });

    let render;
    try {
      render = await submitRender(edit);
    } catch (err) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: String(err.message).slice(0, 800),
        completed_at: new Date().toISOString(),
      });
      return Response.json({ error: 'Shotstack render failed: ' + err.message, job_id: job.id }, { status: 502 });
    }

    await base44.entities.GenerationJob.update(job.id, {
      provider_job_id: render.id,
      input_data: {
        ...job.input_data,
        shotstack_base: render.base,
      },
    });

    return Response.json({
      job_id: job.id,
      render_id: render.id,
      status: 'processing',
      provider: 'shotstack',
      duration_s: totalSeconds,
      scene_count: scenes.length,
      attribution,
      credit_cost: cost,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}