/**
 * Shared finalization for a completed stem separation, whatever engine produced it.
 *
 * Extracted so Tempolor and Sever cannot drift apart. Separation results feed the
 * BASE Mark cascade, the Creative Ownership Score and the derived-asset chain, so
 * two copies of this filing logic would eventually mean two different provenance
 * stories for the same operation.
 *
 * Everything here is deliberate:
 *  - Credits are deducted ON COMPLETION ONLY, and only once (guarded by the job's
 *    credits_used), so a failed separation is never billed and a repeated poll
 *    cannot double-charge.
 *  - Stems INHERIT the source's GenAI label. Separation is not generative: it
 *    cannot make a human recording AI-generated, and it cannot launder an
 *    AI-generated one into 'human'.
 *  - A stem name with no schema enum slot (guitar, piano, bundle) keeps its true
 *    name in metadata rather than being forced into a value the schema rejects.
 */

const VALID_STEM_TYPES = new Set([
  'vocals', 'drums', 'bass', 'other', 'instruments', 'melody', 'harmony', 'fx',
]);

export interface StemFile {
  /** Schema enum value, or a label with no slot (e.g. 'bundle') */
  stem_type: string;
  /** True stem name from the engine, e.g. 'guitar' — kept even when it has no enum slot */
  label?: string;
  file_url: string;
}

export interface FinalizeStemsOptions {
  job: any;
  files: StemFile[];
  provider: string;
  separationModel: string;
  cost: number;
  tool?: string;
}

export async function finalizeStemJob(base44: any, opts: FinalizeStemsOptions) {
  const { job, files, provider, separationModel, cost, tool = 'stem_creator' } = opts;

  const srcList = await base44.entities.UserAsset.filter({ id: job.input_data?.assetId });
  const source = srcList[0];

  const stems = [];
  for (const part of files) {
    const label = part.label || part.stem_type;
    const hasEnumSlot = VALID_STEM_TYPES.has(part.stem_type);

    const asset = await base44.entities.UserAsset.create({
      user_id: job.user_id,
      user_email: job.user_email,
      asset_type: 'stem',
      title: `${source?.title || 'Track'} — ${label}`,
      description: `${label} stem separated from ${source?.title || 'source track'}`,
      file_url: part.file_url,
      thumbnail_url: source?.thumbnail_url,
      origin: source?.origin || 'creator',
      // Separation is non-generative — inherit the source's GenAI label.
      ...(source?.ai_label && { ai_label: source.ai_label }),
      ai_disclosure_label: source?.ai_disclosure_label || 'ai_generated',
      ai_disclosure_basis: 'Derived asset — stem separated from a source recording.',
      human_participation_score: 25,
      participation_signals: { reference_material: 15, iteration: 10 },
      parent_asset_id: source?.id,
      ...(hasEnumSlot && { stem_type: part.stem_type }),
      tags: ['stem', label, ...(source?.tags || [])],
      metadata: {
        stem_type: label,
        is_bundle: label === 'bundle',
        source_asset_id: source?.id,
        source_title: source?.title,
        provider,
        separation_model: separationModel,
        bpm: source?.metadata?.bpm,
        key: source?.metadata?.key,
        provenance: {
          created_by: tool,
          providers_used: [provider],
          stems_used: [],
          remix_sources: source?.id ? [source.id] : [],
        },
      },
    });
    stems.push(asset);
  }

  const completedAt = new Date().toISOString();
  const labels = files.map((f) => f.label || f.stem_type);

  await base44.asServiceRole.entities.GenerationJob.update(job.id, {
    status: 'completed',
    output_url: stems[0]?.file_url,
    output_metadata: {
      stems: labels,
      stem_asset_ids: stems.map((s: any) => s.id),
      separation_model: separationModel,
    },
    credits_used: cost,
    completed_at: completedAt,
  });

  // Deduct once. A zero cost still short-circuits — there is nothing to charge.
  if (!job.credits_used && cost > 0) {
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
        related_job_id: job.id, provider,
        description: `Stem separation — ${stems.length} stems`,
      });
    } catch (e: any) {
      console.warn('Stem credit deduction failed:', e.message);
    }
  }

  try {
    const logs = await base44.asServiceRole.entities.APIUsageLog.filter({ job_id: job.id });
    const pending = logs.find((l: any) => l.status === 'pending');
    if (pending) {
      await base44.asServiceRole.entities.APIUsageLog.update(pending.id, {
        status: 'success', credits_used: cost, timestamp: completedAt,
        metadata: { ...(pending.metadata || {}), stems: labels },
      });
    }
  } catch { /* non-blocking */ }

  await base44.asServiceRole.entities.StudioHistory.create({
    user_id: job.user_id, user_email: job.user_email,
    tool,
    asset_id: stems[0]?.id,
    source_asset_ids: source?.id ? [source.id] : [],
    title: `Separated ${stems.length} stems from "${source?.title || 'track'}"`,
    metadata: { provider, stems: labels, separation_model: separationModel },
  }).catch(() => {});

  return stems;
}