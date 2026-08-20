import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';
import { createStemTask } from '../../shared/tempolorStems.ts';

/**
 * Stem Creator Studio — real stem separation via Tempolor (Stems v2).
 *
 * This submits an async provider task and returns a processing GenerationJob.
 * Results are collected by pollTempolorStems, which is also where credits are
 * deducted — nothing is charged for a separation that never lands.
 *
 * Payload: { assetId }
 * Returns: { data: { job_id, status: 'processing', provider: 'tempcolor' } }
 */

// Flat cost: separation is ONE provider call regardless of how many stems come
// back, so the old per-stem multiplier no longer described what was billed.
// 8 credits matches what a full 4-stem run cost before.
const SEPARATION_COST = 8;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });

    const sourceList = await base44.entities.UserAsset.filter({ id: assetId });
    const source = sourceList[0];
    if (!source) return Response.json({ error: 'Source asset not found' }, { status: 404 });
    if (source.asset_type !== 'track') {
      return Response.json({ error: 'Source must be a track' }, { status: 400 });
    }
    if (!source.file_url) {
      return Response.json({ error: 'Source track has no audio file' }, { status: 400 });
    }

    // ── Credit gate (charged on completion, not here) ──
    const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = recs[0]?.balance ?? 0;
    if (balance < SEPARATION_COST) {
      return Response.json({
        error: 'Insufficient credits',
        required: SEPARATION_COST,
        balance,
        message: `Stem separation costs ${SEPARATION_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const itemId = await createStemTask(source.file_url);

    const startedAt = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'music',
      provider: 'tempcolor',
      status: 'processing',
      input_data: {
        action: 'stem_separation',
        assetId,
        source_title: source.title,
        credit_cost: SEPARATION_COST,
      },
      provider_job_id: itemId,
      started_at: startedAt,
    });

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'tempcolor', task: 'stem_separation',
      credits_used: 0, status: 'pending',
      timestamp: startedAt, job_id: job.id,
      metadata: { action: 'stem_separation', source_asset_id: assetId, provider_job_id: itemId },
    }).catch(() => {});

    return Response.json({
      data: { job_id: job.id, status: 'processing', provider: 'tempcolor', item_id: itemId },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});