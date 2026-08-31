import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { submitSeverJob, SEVER_MODEL } from '../../shared/severStems.ts';

/**
 * Stem separation on Sever — our own HTDemucs-6s engine.
 *
 * Replaces the Tempolor path: same submit-and-poll shape, but the compute is ours,
 * so the cost is a queue slot rather than a per-call API charge. Six stems instead
 * of four (adds guitar and piano).
 *
 * Payload: { assetId, stems? }
 * Returns: { data: { job_id, status: 'processing', provider: 'sever' } }
 *
 * Credits are deducted by pollSeverStems on completion — nothing is charged for a
 * separation that never lands.
 */

// Our own CPU Space, so this is an abuse/queue guard rather than a cost pass-through.
// Tempolor's equivalent run is 8.
const SEPARATION_COST = 2;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, stems } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });

    const sourceList = await base44.entities.UserAsset.filter({ id: assetId });
    const source = sourceList[0];
    if (!source) return Response.json({ error: 'Source asset not found' }, { status: 404 });
    if (!source.file_url) {
      return Response.json({ error: 'Source track has no audio file' }, { status: 400 });
    }

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

    const engineJobId = await submitSeverJob(source.file_url, stems);

    const startedAt = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'music',
      provider: 'sever',
      status: 'processing',
      input_data: {
        action: 'stem_separation',
        assetId,
        source_title: source.title,
        credit_cost: SEPARATION_COST,
        requested_stems: stems || null,
        engine: SEVER_MODEL,
      },
      provider_job_id: engineJobId,
      started_at: startedAt,
    });

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'sever', task: 'stem_separation',
      credits_used: 0, status: 'pending',
      timestamp: startedAt, job_id: job.id,
      metadata: { action: 'stem_separation', source_asset_id: assetId, provider_job_id: engineJobId, engine: SEVER_MODEL },
    }).catch(() => {});

    return Response.json({
      data: { job_id: job.id, status: 'processing', provider: 'sever', engine_job_id: engineJobId },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});