import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';
import { queryStemTask, normalizeStemUrls, expandStemArchive } from '../../shared/tempolorStems.ts';
import { finalizeStemJob } from '../../shared/stemFinalize.ts';

/**
 * Poll a Tempolor stem-separation job and finalize it.
 *
 * Payload: { job_id }
 * Returns: { status: 'processing' } | { status: 'completed', stems: [...] } | { status: 'failed', error }
 *
 * Credits are deducted HERE, on first successful completion only — a failed or
 * still-running separation is never billed, and the credits_used guard keeps a
 * repeated poll from double-charging.
 */

async function upload(base44, bytes: Uint8Array | ArrayBuffer, filename: string) {
  const safe = filename.replace(/[^\w.\-]/g, '_');
  const file = new File([bytes], safe, { type: 'application/octet-stream' });
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  return up?.file_url;
}

// Copy provider files into Base44 storage — provider links expire.
async function persist(base44, url: string, filename: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) return url;
    return (await upload(base44, await r.arrayBuffer(), filename)) || url;
  } catch {
    return url;
  }
}

/**
 * Turn the provider result into [{ stem_type, file_url }] in Base44 storage.
 *
 * Tempolor returns ONE download for a separation, which is a zip of the stems —
 * so a single 'bundle' entry is unpacked into its individual audio files here.
 * If it isn't a zip, it's kept as one file rather than mislabelled as a stem.
 */
async function collectStemFiles(base44, parts, titleStem: string) {
  const single = parts.length === 1 && parts[0].stem_type === 'bundle';
  if (single) {
    const res = await fetch(parts[0].url);
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const expanded = await expandStemArchive(bytes);
      if (expanded.length > 0) {
        const out = [];
        for (const e of expanded) {
          const fileUrl = await upload(base44, e.bytes, `${titleStem}_${e.filename}`);
          if (fileUrl) out.push({ stem_type: e.stem_type, file_url: fileUrl });
        }
        return out;
      }
      // Not a zip — keep the single delivered file.
      const fileUrl = await upload(base44, bytes, `${titleStem}_stems.wav`);
      return [{ stem_type: 'bundle', file_url: fileUrl || parts[0].url }];
    }
  }

  const out = [];
  for (const p of parts) {
    out.push({ stem_type: p.stem_type, file_url: await persist(base44, p.url, `${titleStem}_${p.stem_type}.wav`) });
  }
  return out;
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
      const existing = await base44.entities.UserAsset.filter({ parent_asset_id: job.input_data?.assetId, asset_type: 'stem' });
      return Response.json({ status: 'completed', stems: existing });
    }
    if (job.status === 'failed') {
      return Response.json({ status: 'failed', error: job.error_message || 'Separation failed' });
    }

    const result = await queryStemTask(job.provider_job_id);
    if (!result) return Response.json({ status: 'processing' });

    if (result.status === 'failed' || result.status === 'part_failed') {
      await base44.asServiceRole.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: result.err_msg || 'Tempolor stem separation failed',
      });
      return Response.json({ status: 'failed', error: 'Tempolor stem separation failed' });
    }

    if (result.status !== 'succeeded') return Response.json({ status: 'processing' });

    const parts = normalizeStemUrls(result.stems_url);
    if (parts.length === 0) {
      await base44.asServiceRole.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: 'Tempolor returned no stem files',
      });
      return Response.json({ status: 'failed', error: 'Tempolor returned no stem files' });
    }

    const titleStem = (job.input_data?.source_title || 'track').slice(0, 40);
    const files = await collectStemFiles(base44, parts, titleStem);
    if (files.length === 0) {
      await base44.asServiceRole.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: 'Could not read the separated stem files',
      });
      return Response.json({ status: 'failed', error: 'Could not read the separated stem files' });
    }

    const stems = await finalizeStemJob(base44, {
      job,
      files: files.map(p => ({ stem_type: p.stem_type, label: p.stem_type, file_url: p.file_url })),
      provider: 'tempcolor',
      separationModel: 'stems_v2',
      cost: job.input_data?.credit_cost ?? 8,
    });

    return Response.json({ status: 'completed', stems });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});