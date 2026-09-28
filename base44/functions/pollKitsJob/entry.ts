import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { dispatchNext, finalizeKits, queueInfo } from '../../shared/kitsQueue.ts';

/**
 * Poll a Kits job. Each poll also nudges the shared dispatcher, so the queue
 * advances as long as anyone is waiting.
 * Payload: { job_id }
 * Returns: { status:'pending', queue:{position, eta_seconds} } | { status:'processing' }
 *        | { status:'completed', asset?|voice? } | { status:'failed', error }
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { job_id } = await req.json();
    let job = (await base44.entities.GenerationJob.filter({ id: job_id }))[0];
    if (!job || job.provider !== 'kits') return Response.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (job.status === 'completed') {
      const m = job.output_metadata || {};
      if (m.asset_id) return Response.json({ status: 'completed', asset: (await base44.entities.UserAsset.filter({ id: m.asset_id }))[0] });
      return Response.json({ status: 'completed', voice: (await base44.entities.KitsVoice.filter({ id: m.voice_id }))[0] });
    }
    if (job.status === 'failed') return Response.json({ status: 'failed', error: job.error_message || 'Kits render failed' });

    if (job.status === 'pending') {
      const d = await dispatchNext(base44);
      job = (await base44.entities.GenerationJob.filter({ id: job_id }))[0];
      if (job.status === 'pending') return Response.json({ status: 'pending', queue: await queueInfo(base44, job, d.wait_ms) });
      if (job.status === 'failed') return Response.json({ status: 'failed', error: job.error_message });
      return Response.json({ status: 'processing' });
    }

    return Response.json(await finalizeKits(base44, job));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}