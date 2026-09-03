// pollNovaH3Job — read one window of a Nova (MiniMax-H3) render's event stream
// and finalize it if it has landed.
//
// Idempotent by design: a job that is already completed or failed returns its
// stored result without touching the engine, so a frontend that polls twice can
// never double-charge a creator or duplicate an asset.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  NOVA_AUDIO_SAMPLE_RATE, NOVA_FPS, NOVA_MODEL_ID, NOVA_MODEL_LABEL,
  novaDeduct, persistNovaVideo, pollNovaEvent,
} from '../../shared/novaH3.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id } = await req.json();
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const job = await base44.entities.GenerationJob.get(job_id);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (job.status === 'completed') {
      return Response.json({ status: 'completed', video_url: job.output_url, job_id, ...(job.output_metadata || {}) });
    }
    if (job.status === 'failed' || job.status === 'cancelled') {
      return Response.json({ status: job.status, error: job.error_message || '', job_id });
    }
    if (!job.provider_job_id) {
      return Response.json({ error: 'This job has no engine reference' }, { status: 400 });
    }

    const ev = await pollNovaEvent(job.provider_job_id);

    if (ev.status === 'processing') {
      return Response.json({ status: 'processing', job_id });
    }

    if (ev.status === 'failed') {
      await base44.entities.GenerationJob.update(job_id, {
        status: 'failed', error_message: ev.error, completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', error: ev.error, job_id });
    }

    // ── Completed: persist first, then record. A Space URL dies with its worker,
    // so the storage copy is what everything downstream points at.
    const input = job.input_data || {};
    const title = String(input.prompt || 'Nova video').slice(0, 60);
    const persisted = await persistNovaVideo(base44, ev.videoUrl, title);

    const metadata = {
      provider: 'novah3',
      engine: 'hf_zerogpu',
      model: NOVA_MODEL_ID,
      model_label: NOVA_MODEL_LABEL,
      attribution: 'MiniMax-H3',
      prompt: input.prompt || '',
      canvas: input.canvas || '',
      preset: input.preset || '',
      steps: input.steps || null,
      frames: input.frames || null,
      fps: NOVA_FPS,
      duration: input.snapped_duration || null,
      seed: input.seed ?? null,
      // H3 denoises the soundtrack in the same pass as the picture — recorded so
      // a downstream surface never treats this MP4 as silent video.
      has_native_audio: true,
      audio_sample_rate: NOVA_AUDIO_SAMPLE_RATE,
      engine_detail: ev.detail || '',
      bytes: persisted.bytes,
    };

    const completedAt = new Date().toISOString();
    await base44.entities.GenerationJob.update(job_id, {
      status: 'completed',
      output_url: persisted.fileUrl,
      output_metadata: metadata,
      credits_used: input.credit_cost || 0,
      completed_at: completedAt,
    });

    const asset = await base44.entities.UserAsset.create({
      user_id: user.id, user_email: user.email,
      asset_type: 'video',
      title,
      file_url: persisted.fileUrl,
      is_public: false,
      metadata: { ...metadata, generation_job_id: job_id, generated_at: completedAt },
    }).catch(() => null);

    let remaining = null;
    if (input.credit_cost) {
      remaining = await novaDeduct(base44, user, input.credit_cost, job_id);
    }

    return Response.json({
      status: 'completed',
      job_id,
      video_url: persisted.fileUrl,
      asset_id: asset?.id || null,
      credits_used: input.credit_cost || 0,
      credits_remaining: remaining,
      ...metadata,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}