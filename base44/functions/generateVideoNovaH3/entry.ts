// generateVideoNovaH3 — queue a Nova (MiniMax-H3) video render on our own
// self-hosted ZeroGPU Space.
//
// Deliberately its own function rather than a branch inside generateVideoLTX:
// LTX has a model ladder, per-second cloud pricing and a private-Space fallback
// chain, none of which apply here. Keeping them apart is what guarantees a Nova
// change can never break LTX rendering.
//
// Submit-and-poll: this creates the job and hands back a job id. pollNovaH3Job
// finishes the work — persisting the MP4, saving the asset and charging credits —
// so a render that never lands is never billed.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  NOVA_CANVASES, NOVA_DEFAULT_CANVAS, NOVA_DEFAULT_PRESET, NOVA_PRESETS,
  NOVA_MAX_DURATION, NOVA_MIN_DURATION, NOVA_MODEL_ID, NOVA_FPS,
  novaCreditCost, screenNovaRequest, snapFrames, snappedSeconds, submitNovaJob,
} from '../../shared/novaH3.ts';

function httpsOnly(url) {
  return !!url && /^https:\/\/[^/]+\./i.test(url);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      prompt = '',
      canvas = NOVA_DEFAULT_CANVAS,
      duration = 5,
      preset = NOVA_DEFAULT_PRESET,
      seed,
      first_frame_url = '',
      last_frame_url = '',
      references = [],
      enhance_prompt = false,
      shot_index = 0,
    } = body;

    if (!prompt || !String(prompt).trim()) {
      return Response.json({ error: 'MiniMax-H3 always needs a prompt, keyframes or not.' }, { status: 400 });
    }
    if (!NOVA_CANVASES.some((c) => c.label === canvas)) {
      return Response.json({ error: `Unsupported format: ${canvas}` }, { status: 400 });
    }
    if (!NOVA_PRESETS[preset]) {
      return Response.json({ error: `Unknown speed preset: ${preset}` }, { status: 400 });
    }
    const secs = Number(duration);
    if (!(secs >= NOVA_MIN_DURATION && secs <= NOVA_MAX_DURATION)) {
      return Response.json({ error: `Length must be between ${NOVA_MIN_DURATION}s and ${NOVA_MAX_DURATION}s` }, { status: 400 });
    }

    // Licence safeguard — refused before any GPU booking is spent.
    const refusal = screenNovaRequest(String(prompt));
    if (refusal) {
      return Response.json({ error: `This request can't run on Nova: ${refusal}. MiniMax-H3's acceptable use policy prohibits it.` }, { status: 400 });
    }

    // Keyframes and omni references are separate conditioning paths on the model
    // and cannot be mixed in one shot — the engine refuses the combination.
    const refs = (Array.isArray(references) ? references : []).filter(httpsOnly).slice(0, 12);
    const hasKeyframes = httpsOnly(first_frame_url) || httpsOnly(last_frame_url);
    if (hasKeyframes && refs.length) {
      return Response.json({ error: 'Choose keyframes or omni references for one shot, not both.' }, { status: 400 });
    }

    const cost = novaCreditCost(preset, secs, canvas);
    const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = credits[0]?.balance ?? 0;
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits',
        required: cost, balance,
        message: `This Nova render costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const frames = snapFrames(secs);
    const realSeconds = snappedSeconds(secs);
    const usedSeed = Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 1000000);

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'video', provider: 'novah3',
      status: 'processing',
      input_data: {
        prompt: String(prompt).slice(0, 2000),
        model: NOVA_MODEL_ID,
        canvas, preset, steps: NOVA_PRESETS[preset].steps,
        acceleration: NOVA_PRESETS[preset].acceleration,
        requested_duration: secs,
        snapped_duration: realSeconds,
        frames, fps: NOVA_FPS,
        seed: usedSeed,
        enhance_prompt: !!enhance_prompt,
        first_frame_url: httpsOnly(first_frame_url) ? first_frame_url : null,
        last_frame_url: httpsOnly(last_frame_url) ? last_frame_url : null,
        references: refs,
        shot_index: Number(shot_index) || 0,
        credit_cost: cost,
      },
      started_at: new Date().toISOString(),
    });

    let eventId = '';
    try {
      const submitted = await submitNovaJob({
        prompt: String(prompt),
        canvas, duration: secs, preset, seed: usedSeed,
        firstFrameUrl: httpsOnly(first_frame_url) ? first_frame_url : '',
        lastFrameUrl: httpsOnly(last_frame_url) ? last_frame_url : '',
        references: refs,
        enhancePrompt: !!enhance_prompt,
      });
      eventId = submitted.eventId;
    } catch (e) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: e.message, completed_at: new Date().toISOString(),
      });
      return Response.json({ error: e.message, job_id: job.id }, { status: 502 });
    }

    await base44.entities.GenerationJob.update(job.id, { provider_job_id: eventId });

    await base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'novah3', task: 'generate_video',
      credits_used: cost, status: 'pending',
      timestamp: new Date().toISOString(), job_id: job.id,
      metadata: {
        model_version: NOVA_MODEL_ID,
        input_parameters: { prompt: String(prompt).slice(0, 200), canvas, preset, frames, seed: usedSeed },
        provider_job_id: eventId,
      },
    }).catch(() => {});

    return Response.json({
      job_id: job.id,
      provider_job_id: eventId,
      status: 'processing',
      canvas, preset,
      frames, fps: NOVA_FPS,
      duration: realSeconds,
      seed: usedSeed,
      credit_cost: cost,
      model: NOVA_MODEL_ID,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}