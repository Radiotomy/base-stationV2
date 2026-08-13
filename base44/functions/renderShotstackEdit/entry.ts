// renderShotstackEdit — renders a raw Shotstack edit JSON produced by the
// browser-based Studio SDK timeline editor. Async: returns a job_id that
// pollGenerationJob finalizes (persists MP4, deducts credits, saves to library).
//
// Credits: 5 base + 1 per clip — charged on success only.
//
// Payload: { edit: { timeline: {...}, output: {...} } }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { submitRender } from '../../shared/shotstack.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const edit = body.edit;
    const tracks = edit?.timeline?.tracks;
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return Response.json({ error: 'Edit has no timeline tracks' }, { status: 400 });
    }

    let clipCount = 0;
    let totalSeconds = 0;
    for (const track of tracks) {
      for (const clip of (track.clips || [])) {
        clipCount++;
        totalSeconds = Math.max(totalSeconds, (clip.start || 0) + (clip.length || 0));
      }
    }
    if (clipCount === 0) return Response.json({ error: 'Edit has no clips' }, { status: 400 });

    const cost = 5 + clipCount;
    const creditRows = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = creditRows[0]?.balance ?? 0;
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits',
        required: cost, balance,
        message: `This render costs ${cost} credits (5 base + ${clipCount} clips). You have ${balance}.`,
      }, { status: 402 });
    }

    // Normalize output — the SDK template carries size, we enforce mp4 + fps
    const size = edit.output?.size || { width: 1280, height: 720 };
    const outEdit = {
      timeline: edit.timeline,
      output: { format: 'mp4', fps: edit.output?.fps || 25, size },
    };

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'video', provider: 'shotstack',
      status: 'processing',
      input_data: {
        source: 'studio_timeline',
        clip_count: clipCount,
        track_count: tracks.length,
        width: size.width, height: size.height,
        fps: outEdit.output.fps,
        duration: Math.round(totalSeconds * 100) / 100,
        credit_cost: cost,
      },
      started_at: new Date().toISOString(),
    });

    let render;
    try {
      render = await submitRender(outEdit);
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
      input_data: { ...job.input_data, shotstack_base: render.base },
    });

    return Response.json({
      job_id: job.id,
      render_id: render.id,
      status: 'processing',
      provider: 'shotstack',
      clip_count: clipCount,
      duration_s: Math.round(totalSeconds * 100) / 100,
      credit_cost: cost,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}