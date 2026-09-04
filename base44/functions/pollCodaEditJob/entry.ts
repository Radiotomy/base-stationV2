// Idempotent poller for Coda edit-task jobs (cover / repaint / extract).
// On engine completion: persists the WAV to platform storage (Space storage is
// ephemeral), files a UserAsset, marks the job completed and deducts credits.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getCodaStatus, codaAbsoluteUrl, CODA_EDIT_COST } from '../../shared/codaEngine.ts';
import { cosForDerived } from '../../shared/cosStamp.ts';

const TASK_LABEL = { cover: 'Cover', repaint: 'Repaint', extract: 'Stem extract' };

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id } = await req.json();
    if (!job_id) return Response.json({ error: 'Missing job_id' }, { status: 400 });

    const jobs = await base44.entities.GenerationJob.filter({ id: job_id }).catch(() => []);
    const job = jobs[0];
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!job.input_data?.coda_edit) return Response.json({ error: 'Not a Coda edit job' }, { status: 400 });

    // Terminal short-circuit — polling a finished job must never re-run side effects
    if (job.status === 'completed') {
      return Response.json({ status: 'completed', output_url: job.output_url, asset_id: job.output_metadata?.asset_id });
    }
    if (job.status === 'failed') {
      return Response.json({ status: 'failed', error: job.error_message });
    }

    let engine;
    try {
      engine = await getCodaStatus(job.provider_job_id);
    } catch {
      // Transient network / cold-start hiccup — stay processing, never fail the job for it
      return Response.json({ status: 'processing', progress: 'Engine status unavailable — retrying…' });
    }

    if (engine.status === 'failed') {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: engine.error || 'Coda engine reported failure',
        completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', error: engine.error || 'Engine failure' });
    }
    if (engine.status !== 'completed') {
      return Response.json({ status: 'processing', progress: engine.progress });
    }
    if (!engine.downloadUrl) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: 'Engine completed but returned no output URL',
        completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', error: 'No output URL from engine' });
    }

    // Persist off the ephemeral Space immediately
    const f = await fetch(codaAbsoluteUrl(engine.downloadUrl), { signal: AbortSignal.timeout(180000) });
    if (!f.ok) return Response.json({ status: 'processing', progress: 'Output not fetchable yet — retrying…' });
    const buf = new Uint8Array(await f.arrayBuffer());
    if (buf.length < 10000) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: 'Engine output too small to be audio',
        completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', error: 'Output too small to be audio' });
    }
    const task = job.input_data.task;
    const safe = (job.input_data.title || `coda_${task}`).replace(/[^\w.\-]/g, '_').slice(0, 60);
    const up = await base44.integrations.Core.UploadFile({ file: new File([buf], `${safe}.wav`, { type: 'audio/wav' }) });
    if (!up?.file_url) return Response.json({ status: 'processing', progress: 'Persisting output — retrying…' });

    const label = TASK_LABEL[task] || 'Edit';
    const title = job.input_data.title || `${label} — Coda`;

    // A Coda edit is a DERIVED work: the creator supplied the source recording,
    // so it is scored on the derived-asset rules rather than as a fresh prompt
    // generation. The RIAA track label below is kept as-is — a stem extract is
    // 'ai_assisted' work on a human-chosen recording, and that is a separate
    // judgement from the participation score.
    const { fields: cos } = cosForDerived({
      prompt: job.input_data.prompt || '',
      sourceCount: 1,
      isIteration: true,
    });
    const asset = await base44.entities.UserAsset.create({
      user_id: user.id,
      user_email: user.email,
      asset_type: task === 'extract' ? 'stem' : 'track',
      title,
      file_url: up.file_url,
      is_public: false,
      origin: 'creator',
      ai_label: task === 'extract' ? 'ai_assisted' : 'ai_generated',
      ...cos,
      ai_disclosure_basis: `${label} performed by the Coda engine (ACE-Step 1.5) on creator-supplied source audio. `
        + cos.ai_disclosure_basis,
      ...(task === 'extract' && job.input_data.track_name ? { stem_type: ['vocals','drums','bass'].includes(job.input_data.track_name) ? job.input_data.track_name : 'other' } : {}),
      tags: ['coda-edit', task],
      metadata: {
        engine: 'coda',
        task,
        source_url: job.input_data.src_audio_url,
        seed: job.input_data.seed,
        sample_rate: 48000,
        ...(task === 'repaint' ? { repaint_start: job.input_data.repaint_start, repaint_end: job.input_data.repaint_end } : {}),
        ...(task === 'cover' ? { cover_strength: job.input_data.cover_strength } : {}),
        ...(task === 'extract' ? { track_name: job.input_data.track_name } : {}),
      },
    });

    await base44.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: up.file_url,
      output_metadata: { asset_id: asset.id, task, sample_rate: 48000 },
      credits_used: CODA_EDIT_COST,
      completed_at: new Date().toISOString(),
    });

    // Deduct on completion only
    const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const rec = recs[0];
    if (rec) {
      const newBalance = Math.max(0, (rec.balance || 0) - CODA_EDIT_COST);
      await base44.asServiceRole.entities.UserCredit.update(rec.id, {
        balance: newBalance,
        lifetime_spent: (rec.lifetime_spent || 0) + CODA_EDIT_COST,
        monthly_used: (rec.monthly_used || 0) + CODA_EDIT_COST,
      });
      await base44.asServiceRole.entities.CreditLog.create({
        user_id: user.id, user_email: user.email,
        transaction_type: 'generation',
        amount: -CODA_EDIT_COST,
        balance_before: rec.balance,
        balance_after: newBalance,
        related_job_id: job.id, provider: 'harmonix',
        description: `Coda ${label.toLowerCase()} edit task`,
      }).catch(() => {});
    }

    return Response.json({ status: 'completed', output_url: up.file_url, asset_id: asset.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}