import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { AI_BASE, sonicHeaders, sonicStemType } from '../../shared/sonicClient.ts';
import { finalizeStemJob } from '../../shared/stemFinalize.ts';

/**
 * Poll a Sonic stems task (GET /sonic/task/{task_id}) and file the stems through the
 * shared finalizer, so Sonic and Sever stems carry identical provenance records.
 * Each returned clip is one stem; its title (or stem_type) names the part.
 *
 * Payload: { job_id }
 */
async function persist(base44: any, url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download stem (${res.status})`);
  const safe = filename.replace(/[^\w.\-]/g, '_');
  const type = /\.wav(\?|$)/i.test(url) ? 'audio/wav' : 'audio/mpeg';
  const file = new File([await res.arrayBuffer()], safe, { type });
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

    const job = (await base44.entities.GenerationJob.filter({ id: job_id }))[0];
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (job.status === 'completed') {
      const ids = job.output_metadata?.stem_asset_ids || [];
      const stems = ids.length ? await base44.entities.UserAsset.filter({ id: { $in: ids } }) : [];
      return Response.json({ status: 'completed', stems });
    }
    if (job.status === 'failed') return Response.json({ status: 'failed', error: job.error_message || 'Separation failed' });

    const res = await fetch(`${AI_BASE}/sonic/task/${job.provider_job_id}`, { headers: sonicHeaders() });
    const data = await res.json().catch(() => ({}));
    if (res.status === 202) return Response.json({ status: 'processing' });
    const clips = Array.isArray(data?.data) ? data.data : [];
    if (!res.ok || clips.length === 0) return Response.json({ status: 'processing' });

    const settled = clips.every(c => c.state === 'succeeded' || c.state === 'failed');
    if (!settled) return Response.json({ status: 'processing' });

    const ok = clips.filter(c => c.state === 'succeeded' && c.audio_url);
    if (ok.length === 0) {
      const msg = clips[0]?.error_message || 'Sonic stem separation failed';
      await base44.asServiceRole.entities.GenerationJob.update(job.id, { status: 'failed', error_message: msg });
      return Response.json({ status: 'failed', error: msg });
    }

    const titleStem = (job.input_data?.source_title || 'track').slice(0, 40);
    const files = [];
    for (let i = 0; i < ok.length; i++) {
      const c = ok[i];
      const label = String(c.stem_type || c.title || `stem ${i + 1}`).replace(/^.*[—-]\s*/, '').trim().toLowerCase();
      const ext = /\.wav(\?|$)/i.test(c.audio_url) ? 'wav' : 'mp3';
      const fileUrl = await persist(base44, c.audio_url, `${titleStem}_${label}.${ext}`);
      files.push({ stem_type: sonicStemType(label), label, file_url: fileUrl });
    }

    const stems = await finalizeStemJob(base44, {
      job, files, provider: 'sonic',
      separationModel: job.input_data?.engine || 'sonic-stems',
      cost: job.input_data?.credit_cost ?? 50,
    });
    return Response.json({ status: 'completed', stems });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});