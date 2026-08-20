import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';
import { queryStemTask, normalizeStemUrls, expandStemArchive } from '../../shared/tempolorStems.ts';

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

    // Load source for provenance inheritance
    const srcList = await base44.entities.UserAsset.filter({ id: job.input_data?.assetId });
    const source = srcList[0];

    const titleStem = (source?.title || 'track').slice(0, 40);
    const files = await collectStemFiles(base44, parts, titleStem);
    if (files.length === 0) {
      await base44.asServiceRole.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: 'Could not read the separated stem files',
      });
      return Response.json({ status: 'failed', error: 'Could not read the separated stem files' });
    }

    const stems = [];
    for (const part of files) {
      const fileUrl = part.file_url;
      const asset = await base44.entities.UserAsset.create({
        user_id: job.user_id,
        user_email: job.user_email,
        asset_type: 'stem',
        title: `${source?.title || 'Track'} — ${part.stem_type}`,
        description: `${part.stem_type} stem separated from ${source?.title || 'source track'}`,
        file_url: fileUrl,
        thumbnail_url: source?.thumbnail_url,
        origin: source?.origin || 'creator',
        // Separation is non-generative — inherit the source's GenAI label.
        ...(source?.ai_label && { ai_label: source.ai_label }),
        ai_disclosure_label: source?.ai_disclosure_label || 'ai_generated',
        ai_disclosure_basis: 'Derived asset — stem separated from a source recording.',
        human_participation_score: 25,
        participation_signals: { reference_material: 15, iteration: 10 },
        parent_asset_id: source?.id,
        // 'bundle' is not a valid stem_type enum value, so it is recorded in
        // metadata only rather than forced into the schema.
        ...(part.stem_type !== 'bundle' && { stem_type: part.stem_type }),
        tags: ['stem', part.stem_type, ...(source?.tags || [])],
        metadata: {
          stem_type: part.stem_type,
          is_bundle: part.stem_type === 'bundle',
          source_asset_id: source?.id,
          source_title: source?.title,
          provider: 'tempcolor',
          separation_model: 'stems_v2',
          bpm: source?.metadata?.bpm,
          key: source?.metadata?.key,
          provenance: {
            created_by: 'stem_creator',
            providers_used: ['tempcolor'],
            stems_used: [],
            remix_sources: source?.id ? [source.id] : [],
          },
        },
      });
      stems.push(asset);
    }

    const completedAt = new Date().toISOString();
    const cost = job.input_data?.credit_cost ?? 8;

    await base44.asServiceRole.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: stems[0]?.file_url,
      output_metadata: { stems: files.map(p => p.stem_type), stem_asset_ids: stems.map(s => s.id) },
      credits_used: cost,
      completed_at: completedAt,
    });

    // Deduct once
    if (!job.credits_used) {
      try {
        const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: job.user_id });
        let record = recs[0];
        if (!record) {
          record = await base44.asServiceRole.entities.UserCredit.create({
            user_id: job.user_id, user_email: job.user_email,
            balance: 0, lifetime_earned: 0, lifetime_spent: 0,
          });
        }
        const newBalance = Math.max(0, (record.balance || 0) - cost);
        await base44.asServiceRole.entities.UserCredit.update(record.id, {
          balance: newBalance,
          lifetime_spent: (record.lifetime_spent || 0) + cost,
          monthly_used: (record.monthly_used || 0) + cost,
        });
        await base44.asServiceRole.entities.CreditLog.create({
          user_id: job.user_id, user_email: job.user_email,
          transaction_type: 'generation', amount: -cost,
          balance_before: record.balance, balance_after: newBalance,
          related_job_id: job.id, provider: 'tempcolor',
          description: `Stem separation — ${stems.length} stems`,
        });
      } catch (e) { console.warn('Stem credit deduction failed:', e.message); }
    }

    // Finalize pending usage log
    try {
      const logs = await base44.asServiceRole.entities.APIUsageLog.filter({ job_id: job.id });
      const pending = logs.find(l => l.status === 'pending');
      if (pending) {
        await base44.asServiceRole.entities.APIUsageLog.update(pending.id, {
          status: 'success', credits_used: cost, timestamp: completedAt,
          metadata: { ...(pending.metadata || {}), stems: files.map(p => p.stem_type) },
        });
      }
    } catch { /* non-blocking */ }

    await base44.asServiceRole.entities.StudioHistory.create({
      user_id: job.user_id, user_email: job.user_email,
      tool: 'stem_creator',
      asset_id: stems[0]?.id,
      source_asset_ids: source?.id ? [source.id] : [],
      title: `Separated ${stems.length} stems from "${source?.title || 'track'}"`,
      metadata: { provider: 'tempcolor', stems: files.map(p => p.stem_type) },
    }).catch(() => {});

    return Response.json({ status: 'completed', stems });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});