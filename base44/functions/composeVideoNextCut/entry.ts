// composeVideoNextCut — Stitch arbitrary scenes (b-roll, video URLs, solids) into
// a single MP4 with an optional audio track via NextCut's /api-render endpoint.
//
// Credits:
//   Base 5 + 1 per scene + 3 if audio attached.
//   Pre-checked, then atomically deducted server-side ON SUCCESS only.
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
// Returns: { job_id, video_url, render_id, cost_usd, duration_s, scene_count,
//           credits_used, credit_balance }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const NEXTCUT_API = Deno.env.get('NEXTCUT_API');

function computeCost(sceneCount, hasAudio) {
  return 5 + sceneCount + (hasAudio ? 3 : 0);
}

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

async function deductCreditsServerSide(base44, user, amount, { provider, job_id, description }) {
  const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  let record = credits[0];
  if (!record) {
    record = await base44.asServiceRole.entities.UserCredit.create({
      user_id: user.id, user_email: user.email,
      balance: 0, lifetime_earned: 0, lifetime_spent: 0,
    });
  }
  const newBalance = (record.balance || 0) - amount;
  if (newBalance < 0) return { ok: false, balance: record.balance };
  await base44.asServiceRole.entities.UserCredit.update(record.id, {
    balance: newBalance,
    lifetime_spent: (record.lifetime_spent || 0) + amount,
    monthly_used: (record.monthly_used || 0) + amount,
  });
  await base44.asServiceRole.entities.CreditLog.create({
    user_id: user.id, user_email: user.email,
    transaction_type: 'generation',
    amount: -amount,
    balance_before: record.balance,
    balance_after: newBalance,
    related_job_id: job_id, provider, description,
  }).catch(() => {});
  return { ok: true, balance: newBalance };
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

    const hasAudio = !!body.audioUrl;
    const cost = computeCost(scenes.length, hasAudio);

    // Pre-check credit balance
    const creditsRows = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = creditsRows[0]?.balance ?? 0;
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits',
        required: cost, balance,
        message: `This music video costs ${cost} credits (5 base + ${scenes.length} scenes${hasAudio ? ' + 3 audio mux' : ''}). You have ${balance}.`,
      }, { status: 402 });
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

    // Create the job record so it shows up in history & analytics
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'video', provider: 'nextcut',
      status: 'processing',
      input_data: {
        scene_count: scenes.length,
        scenes: scenes.map(s => ({ kind: s.kind, query: s.query, duration: s.durationSeconds })),
        has_audio: hasAudio,
        width, height, fps,
        credit_cost: cost,
      },
      started_at: new Date().toISOString(),
    });

    const payload = { scenes: builtScenes, width, height, fps };
    if (body.audioUrl) payload.audio = { src: body.audioUrl };

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
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: errText.slice(0, 800),
        completed_at: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.APIUsageLog.create({
        user_id: user.id, user_email: user.email, user_name: user.full_name,
        provider: 'nextcut', task: 'compose_music_video',
        credits_used: 0, status: 'failed',
        duration_ms: latency, error_message: errText.slice(0, 400),
        job_id: job.id, timestamp: new Date().toISOString(),
      }).catch(() => {});
      return Response.json({
        error: 'NextCut render failed',
        status: res.status,
        detail: errText.slice(0, 800),
        job_id: job.id,
      }, { status: 502 });
    }

    const data = await res.json();
    if (!data.outputUrl) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: 'No outputUrl in NextCut response',
        completed_at: new Date().toISOString(),
      });
      return Response.json({ error: 'No outputUrl in NextCut response', response: data, job_id: job.id }, { status: 502 });
    }

    // SUCCESS — deduct credits now (only on confirmed render)
    const deduct = await deductCreditsServerSide(base44, user, cost, {
      provider: 'nextcut', job_id: job.id,
      description: `Music video (${scenes.length} scenes, ${Math.round(totalSeconds)}s)`,
    });

    await base44.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: data.outputUrl,
      output_metadata: {
        duration_s: totalSeconds,
        scene_count: scenes.length,
        aspect_ratio: `${width}:${height}`,
        cost_usd: data.cost,
        render_id: data.renderId,
        format: 'mp4',
      },
      credits_used: cost,
      provider_job_id: data.renderId,
      completed_at: new Date().toISOString(),
    });

    // Provenance + admin analytics
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest(
      'SHA-256',
      enc.encode(`${user.id}|nextcut|${scenes.length}|${Math.round(totalSeconds)}|${new Date().toISOString()}`)
    );
    const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    await base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'nextcut', task: 'compose_music_video',
      credits_used: cost, status: 'success',
      duration_ms: latency, job_id: job.id,
      timestamp: new Date().toISOString(),
      metadata: {
        model_version: 'nextcut-api-render-v1',
        input_parameters: {
          scene_count: scenes.length,
          has_audio: hasAudio,
          width, height, fps,
        },
        output_details: {
          video_url: data.outputUrl,
          render_id: data.renderId,
          cost_usd: data.cost,
          duration_s: totalSeconds,
        },
        content_hash: contentHash,
        generated_timestamp: new Date().toISOString(),
      },
    }).catch(() => {});

    return Response.json({
      job_id: job.id,
      video_url: data.outputUrl,
      render_id: data.renderId,
      cost_usd: data.cost,
      duration_s: totalSeconds,
      scene_count: scenes.length,
      latency_ms: latency,
      provider: 'nextcut',
      credits_used: cost,
      credit_balance: deduct.ok ? deduct.balance : balance,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack?.slice(0, 600) }, { status: 500 });
  }
});