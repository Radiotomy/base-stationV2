import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sonicPost, resolveClipId } from '../../shared/sonicClient.ts';
import { SONIC_COSTS } from '../../shared/sonicPricing.ts';

/**
 * Sonic Studio Stems — the premium alternative to Sever.
 *
 *   basic → POST /sonic/stems/basic  { clip_id }  → 2 tracks (vocal + instrumental)   20 cr
 *   full  → POST /sonic/stems/full   { clip_id }  → 12 tracks (drums, bass, vocals,
 *            backing vocals, guitar, keys, synth, strings, brass, woodwinds, perc, fx)   50 cr
 *
 * Sever (HTDemucs-6s) stays the free-ish default: 6 stems for 2 credits. Sonic is
 * for the creator who needs the 12-way split on a Sonic-generated track.
 *
 * Non-Sonic sources are uploaded first (+2 cr). Credits are deducted on completion
 * by pollSonicStems, so a failed split is never billed.
 *
 * Payload: { assetId, tier: 'basic' | 'full' }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, tier = 'full' } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });
    if (tier !== 'basic' && tier !== 'full') return Response.json({ error: 'tier must be basic or full' }, { status: 400 });

    const source = (await base44.entities.UserAsset.filter({ id: assetId }))[0];
    if (!source) return Response.json({ error: 'Source asset not found' }, { status: 404 });

    const needsUpload = !source.metadata?.clip_id && !source.metadata?.sonic_upload_clip_id;
    const cost = (tier === 'full' ? SONIC_COSTS.stems_full : SONIC_COSTS.stems_basic) + (needsUpload ? SONIC_COSTS.upload : 0);

    const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = recs[0]?.balance ?? 0;
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits', required: cost, balance,
        message: `Sonic ${tier} stems cost ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    let clipId;
    try {
      ({ clipId } = await resolveClipId(base44, source));
      const data = await sonicPost(`/sonic/stems/${tier}`, { clip_id: clipId });
      if (!data.task_id) throw new Error('Sonic returned no task_id');

      const startedAt = new Date().toISOString();
      const job = await base44.entities.GenerationJob.create({
        user_id: user.id, user_email: user.email,
        job_type: 'music', provider: 'sonic', status: 'processing',
        input_data: {
          action: 'stem_separation', assetId, source_title: source.title,
          credit_cost: cost, tier, clip_id: clipId, engine: `sonic-stems-${tier}`,
        },
        provider_job_id: data.task_id, started_at: startedAt,
      });

      base44.asServiceRole.entities.APIUsageLog.create({
        user_id: user.id, user_email: user.email, user_name: user.full_name,
        provider: 'sonic', task: `stems_${tier}`, credits_used: 0, status: 'pending',
        timestamp: startedAt, job_id: job.id,
        metadata: { action: 'stem_separation', source_asset_id: assetId, clip_id: clipId, tier, provider_job_id: data.task_id },
      }).catch(() => {});

      return Response.json({ data: { job_id: job.id, status: 'processing', provider: 'sonic', tier, cost } });
    } catch (e) {
      const s = e.providerStatus;
      return Response.json({ error: e.message, provider_status: s || null }, { status: s === 402 ? 402 : s === 429 ? 429 : 502 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});