import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getSeverStatus, absoluteSeverUrl, stemTypeFor, SEVER_MODEL } from '../../shared/severStems.ts';
import { finalizeStemJob } from '../../shared/stemFinalize.ts';

/**
 * Poll a Sever stem-separation job and finalize it.
 *
 * Payload: { job_id }
 * Returns: { status: 'processing' } | { status: 'completed', stems: [...] } | { status: 'failed', error }
 *
 * Engine output lives in the Space's /tmp and disappears when the Space sleeps, so
 * every stem is copied into Base44 storage here. Returning the engine URL directly
 * would hand the creator a link that dies within the hour.
 */

async function persist(base44: any, url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download stem (${res.status})`);
  const safe = filename.replace(/[^\w.\-]/g, '_');
  const file = new File([await res.arrayBuffer()], safe, { type: 'audio/wav' });
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('Stem upload failed');
  return up.file_url;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id } = await req.json();
    if (!job_id) return Response.json({ error: 'job_id required' }, { status: 400 });

    const jobs = await base44.entities.GenerationJob.filter({ id: job_id });
    const job = jobs[0];
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (job.status === 'completed') {
      const existing = await base44.entities.UserAsset.filter({
        parent_asset_id: job.input_data?.assetId, asset_type: 'stem',
      });
      return Response.json({ status: 'completed', stems: existing });
    }
    if (job.status === 'failed') {
      return Response.json({ status: 'failed', error: job.error_message || 'Separation failed' });
    }

    const result = await getSeverStatus(job.provider_job_id);
    // No answer yet, or the Space is waking up — keep polling rather than failing.
    if (!result) return Response.json({ status: 'processing' });

    if (result.status === 'failed') {
      await base44.asServiceRole.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: result.error || 'Sever separation failed',
      });
      return Response.json({ status: 'failed', error: result.error || 'Sever separation failed' });
    }

    // 'queued' means the engine is busy with another separation — still processing.
    if (result.status !== 'completed') return Response.json({ status: 'processing' });

    const names = Object.keys(result.stems || {});
    if (names.length === 0) {
      await base44.asServiceRole.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: 'Sever returned no stem files',
      });
      return Response.json({ status: 'failed', error: 'Sever returned no stem files' });
    }

    const titleStem = (job.input_data?.source_title || 'track').slice(0, 40);
    const files = [];
    for (const name of names) {
      const fileUrl = await persist(
        base44,
        absoluteSeverUrl(result.stems[name]),
        `${titleStem}_${name}.wav`,
      );
      files.push({ stem_type: stemTypeFor(name), label: name, file_url: fileUrl });
    }

    const stems = await finalizeStemJob(base44, {
      job,
      files,
      provider: 'sever',
      separationModel: SEVER_MODEL,
      cost: job.input_data?.credit_cost ?? 2,
    });

    return Response.json({ status: 'completed', stems });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});