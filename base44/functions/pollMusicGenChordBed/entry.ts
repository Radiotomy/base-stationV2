import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { pollBed, resolveAudioUrl, CADENCE_ENGINE } from '../../shared/cadenceEngine.ts';

/**
 * Poll a Cadence bed render and file the result.
 *
 * Payload: { job_id }
 * Returns: { status: 'processing' } | { status: 'completed', asset } | { status: 'failed', error }
 *
 * The WAV is copied into Base44 storage rather than linked: the Space writes to /tmp,
 * so its output does not survive a restart or a rebuild.
 *
 * The bed is filed as its OWN asset, never merged with the score's vocal render. The
 * two carry different authorship claims — an authored melody versus an AI arrangement
 * of authored chords — and one combined asset could only report the weaker of them.
 */

async function persist(base44: any, url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the bed (${res.status})`);
  const safe = filename.replace(/[^\w.\-]/g, '_');
  const file = new File([await res.arrayBuffer()], safe, { type: 'audio/wav' });
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('Bed upload failed');
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
      const existing = await base44.entities.UserAsset.filter({ id: job.output_metadata?.asset_id });
      return Response.json({ status: 'completed', asset: existing[0] || null });
    }
    if (job.status === 'failed') {
      return Response.json({ status: 'failed', error: job.error_message || 'Bed render failed' });
    }

    const state = await pollBed(job.provider_job_id);

    if (state.status === 'failed') {
      const message = state.error || 'Cadence bed render failed';
      await base44.asServiceRole.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: message,
      });
      return Response.json({ status: 'failed', error: message });
    }

    // 'not_found' means the Space restarted mid-render and lost its job table. Kept
    // as processing rather than failed only until the caller's own attempt budget
    // runs out — inventing a failure here would be as wrong as claiming success.
    if (state.status !== 'completed' || !state.audio) {
      return Response.json({ status: 'processing' });
    }

    const title = job.input_data?.source_title || 'Lead sheet bed';
    const fileUrl = await persist(
      base44,
      resolveAudioUrl(state.audio),
      `${String(title).slice(0, 40)}_bed.wav`,
    );

    const leadSheetId = job.input_data?.lead_sheet_id;

    const asset = await base44.asServiceRole.entities.UserAsset.create({
      user_id: job.user_id,
      user_email: job.user_email,
      asset_type: 'track',
      title: `${title} — instrumental bed`,
      file_url: fileUrl,
      lead_sheet_id: leadSheetId,
      origin: 'creator',
      ai_label: 'ai_assisted',
      ai_disclosure_label: 'ai_assisted',
      ai_disclosure_basis:
        'Chord progression, key and tempo were authored by the creator as a stored lead sheet; the arrangement and instrumentation were generated from that progression.',
      // Deliberately not 100, unlike the vocal render: the harmony is authored but
      // the voicing, groove and instrument choices are the model's. Claiming full
      // authorship here would be the kind of overstatement that makes a score
      // worthless as evidence.
      human_participation_score: 70,
      participation_signals: {
        authored_chords: true,
        authored_melody: false,
        score_hash: job.input_data?.score_hash || null,
        harmony_source: 'human_lead_sheet',
        arrangement_source: 'cadence_musicgen_chord',
      },
      metadata: {
        render_kind: 'lead_sheet_bed',
        engine: CADENCE_ENGINE,
        // Cadence runs Meta's musicgen-melody weights, which are CC-BY-NC 4.0.
        // Recorded ON THE ASSET rather than only in docs: a bed that reaches a
        // distribution or store surface must carry its own restriction, because by
        // then nobody is reading the engine's README. Flips to true once the engine
        // moves to a commercially-clear checkpoint.
        model_weights_license: 'CC-BY-NC-4.0',
        cleared_for_commercial_release: false,
        license_note:
          'Generated with non-commercial model weights (Meta musicgen-melody, CC-BY-NC 4.0). Cleared for personal use, testing and evaluation only — not for sale, paid bundles or commercial release.',
        chord_chart: job.input_data?.chord_chart,
        chord_chart_normalized: job.input_data?.chord_chart_normalized,
        bar_count: job.input_data?.bar_count,
        style: job.input_data?.style,
        bpm: job.input_data?.bpm,
        key: job.input_data?.key,
        time_signature: job.input_data?.time_signature,
        duration: state.duration || job.input_data?.duration,
        lead_sheet_id: leadSheetId,
        score_hash: job.input_data?.score_hash,
        provider_job_id: job.provider_job_id,
      },
      tags: ['lead-sheet', 'instrumental', 'cadence', 'non-commercial'],
    });

    if (leadSheetId) {
      try {
        const sheets = await base44.asServiceRole.entities.LeadSheet.filter({ id: leadSheetId });
        const sheet = sheets[0];
        if (sheet) {
          await base44.asServiceRole.entities.LeadSheet.update(leadSheetId, {
            rendered_asset_ids: [...(sheet.rendered_asset_ids || []), asset.id],
          });
        }
      } catch { /* the bed is filed; a broken back-link must not fail the job */ }
    }

    // Cadence beds are free (non-commercial weights); older rows may still carry a cost.
    const cost = job.input_data?.credit_cost ?? 0;

    await base44.asServiceRole.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: fileUrl,
      output_metadata: {
        asset_id: asset.id,
        duration: state.duration || job.input_data?.duration,
        title,
      },
      credits_used: cost,
      completed_at: new Date().toISOString(),
    });

    // Guarded on the job's own credits_used so a repeated poll cannot double-bill.
    if (cost > 0 && (!job.credits_used || job.credits_used === 0)) {
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
            related_job_id: job.id, provider: 'musicgenchord',
            description: 'Cadence instrumental bed',
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