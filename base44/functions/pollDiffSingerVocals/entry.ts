import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getCantorStatus, absoluteCantorUrl, CANTOR_ENGINE } from '../../shared/diffSinger.ts';

/**
 * Poll a Cantor vocal render and file the result.
 *
 * Payload: { job_id }
 * Returns: { status: 'processing' } | { status: 'completed', asset } | { status: 'failed', error }
 *
 * The render lives in the Space's /tmp and disappears when the Space sleeps, so the
 * WAV is copied into Base44 storage here — returning the engine URL would hand the
 * creator a link that dies within the hour.
 *
 * The saved asset points back at its LeadSheet. That link is the feature: the vocal
 * line came from a hashed, human-authored score, so its participation score is a
 * recorded fact rather than something inferred from prompt telemetry.
 */

async function persist(base44: any, url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the render (${res.status})`);
  const safe = filename.replace(/[^\w.\-]/g, '_');
  const file = new File([await res.arrayBuffer()], safe, { type: 'audio/wav' });
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('Vocal upload failed');
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
        id: job.output_metadata?.asset_id,
      });
      return Response.json({ status: 'completed', asset: existing[0] || null });
    }
    if (job.status === 'failed') {
      return Response.json({ status: 'failed', error: job.error_message || 'Vocal render failed' });
    }

    const result = await getCantorStatus(job.provider_job_id);
    // No answer yet, or the Space is waking up — keep polling rather than failing.
    if (!result) return Response.json({ status: 'processing' });

    if (result.status === 'failed') {
      await base44.asServiceRole.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: result.error || 'Cantor vocal render failed',
      });
      return Response.json({ status: 'failed', error: result.error || 'Cantor vocal render failed' });
    }

    // 'queued' means the engine is busy with another render — still processing.
    if (result.status !== 'completed' || !result.audio_url) {
      return Response.json({ status: 'processing' });
    }

    const title = job.input_data?.source_title || 'Lead sheet vocal';
    const fileUrl = await persist(
      base44,
      absoluteCantorUrl(result.audio_url),
      `${String(title).slice(0, 40)}_vocal.wav`,
    );

    const leadSheetId = job.input_data?.lead_sheet_id;

    const asset = await base44.asServiceRole.entities.UserAsset.create({
      user_id: job.user_id,
      user_email: job.user_email,
      asset_type: 'track',
      title: `${title} — vocal`,
      file_url: fileUrl,
      lead_sheet_id: leadSheetId,
      origin: 'creator',
      // A sung performance of the creator's own melody is AI-assisted, not
      // AI-generated: the composition is human, the voice is synthetic.
      ai_label: 'ai_assisted',
      ai_disclosure_label: 'ai_assisted',
      ai_disclosure_basis:
        'Melody, lyrics and chord chart were authored by the creator as a stored lead sheet; a synthetic singing voice performed that score.',
      // 100 is asserted rather than estimated: every pitch, syllable and duration
      // came from the hashed score, so there is nothing here to infer.
      human_participation_score: 100,
      participation_signals: {
        authored_score: true,
        score_hash: job.input_data?.score_hash || null,
        notes_authored: job.input_data?.note_count || 0,
        melody_source: 'human_lead_sheet',
        voice_source: 'diffsinger_voicebank',
      },
      metadata: {
        render_kind: 'lead_sheet_vocal',
        engine: CANTOR_ENGINE,
        voicebank: result.voicebank || job.input_data?.voicebank,
        bpm: job.input_data?.bpm,
        key: job.input_data?.key,
        sample_rate: result.sample_rate,
        duration: result.duration_seconds,
        lead_sheet_id: leadSheetId,
        score_hash: job.input_data?.score_hash,
        provider_job_id: job.provider_job_id,
      },
      tags: ['lead-sheet', 'vocal', 'cantor'],
    });

    // Link the render back onto the score. One score renders many times — a
    // voicebank swap is a new render of the SAME authorship, not new authorship.
    if (leadSheetId) {
      try {
        const sheets = await base44.asServiceRole.entities.LeadSheet.filter({ id: leadSheetId });
        const sheet = sheets[0];
        if (sheet) {
          await base44.asServiceRole.entities.LeadSheet.update(leadSheetId, {
            rendered_asset_ids: [...(sheet.rendered_asset_ids || []), asset.id],
          });
        }
      } catch { /* the render is filed; a broken back-link must not fail the job */ }
    }

    const cost = job.input_data?.credit_cost ?? 2;

    await base44.asServiceRole.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: fileUrl,
      output_metadata: {
        asset_id: asset.id,
        voicebank: result.voicebank || job.input_data?.voicebank,
        duration: result.duration_seconds,
        sample_rate: result.sample_rate,
        title,
      },
      credits_used: cost,
      completed_at: new Date().toISOString(),
    });

    // Guarded on the job's own credits_used so a repeated poll cannot double-bill.
    if (!job.credits_used || job.credits_used === 0) {
      try {
        const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: job.user_id });
        const record = recs[0];
        if (record) {
          const after = Math.max(0, (record.balance || 0) - cost);
          await base44.asServiceRole.entities.UserCredit.update(record.id, {
            balance: after,
            lifetime_spent: (record.lifetime_spent || 0) + cost,
            monthly_used: (record.monthly_used || 0) + cost,
          });
          await base44.asServiceRole.entities.CreditLog.create({
            user_id: job.user_id, user_email: job.user_email,
            transaction_type: 'generation',
            amount: -cost,
            balance_before: record.balance,
            balance_after: after,
            related_job_id: job.id, provider: 'diffsinger',
            description: 'Cantor lead sheet vocal render',
          });
        }
      } catch (e) { console.warn('Credit deduction failed:', e.message); }
    }

    const logs = await base44.asServiceRole.entities.APIUsageLog.filter({ job_id: job.id }).catch(() => []);
    const pending = logs.find((l: any) => l.status === 'pending');
    if (pending) {
      await base44.asServiceRole.entities.APIUsageLog.update(pending.id, {
        status: 'success', credits_used: cost,
      }).catch(() => {});
    }

    return Response.json({ status: 'completed', asset });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});