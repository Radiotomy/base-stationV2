import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { enqueueKits, loadSourceAndVoice, queueInfo } from '../../shared/kitsQueue.ts';

/**
 * Queue a Kits.ai render on the shared platform key.
 * conversion: { kind:'conversion', assetId, voiceModelId, pitchShift?, conversionStrength?, modelVolumeMix?, assetType?, context? }
 * blend:      { kind:'blend', voiceModelIds:[2..4], alphas:[n-1 values 0..1], title }
 */
const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    let job;

    if (body.kind === 'blend') {
      const ids: string[] = (body.voiceModelIds || []).map(String);
      if (ids.length < 2 || ids.length > 4) return Response.json({ error: 'Pick 2 to 4 voices to blend' }, { status: 400 });
      const voices = await Promise.all(ids.map(async (id) => (await base44.entities.KitsVoice.filter({ model_id: id }))[0]));
      if (voices.some((v) => !v)) return Response.json({ error: 'One of those voices is not available to you' }, { status: 400 });
      const alphas = ids.slice(0, -1).map((_, i) => clamp(body.alphas?.[i], 0, 1, 1 / ids.length));
      if (alphas.reduce((a, b) => a + b, 0) > 1) return Response.json({ error: 'Blend weights add up to more than 100%' }, { status: 400 });
      const last = 1 - alphas.reduce((a, b) => a + b, 0);
      job = await enqueueKits(base44, user, 'blend', {
        model_ids: ids, alphas, title: String(body.title || 'My blended voice').slice(0, 80),
        blend_inputs: voices.map((v, i) => ({ model_id: v.model_id, title: v.title, alpha: i < alphas.length ? alphas[i] : last })),
      });
    } else {
      if (!body.assetId || !body.voiceModelId) return Response.json({ error: 'assetId and voiceModelId required' }, { status: 400 });
      const { input } = await loadSourceAndVoice(base44, body.assetId, body.voiceModelId);
      job = await enqueueKits(base44, user, 'conversion', {
        ...input,
        pitch_shift: Math.round(clamp(body.pitchShift, -24, 24, 0)),
        conversion_strength: clamp(body.conversionStrength, 0, 1, 0.5),
        model_volume_mix: clamp(body.modelVolumeMix, 0, 1, 0.5),
        asset_type: ['track', 'stem'].includes(body.assetType) ? body.assetType : 'track',
        context: String(body.context || 'kits_conversion').slice(0, 40),
        assetId: body.assetId,
      });
    }

    const fresh = (await base44.entities.GenerationJob.filter({ id: job.id }))[0] || job;
    const queue = fresh.status === 'pending' ? await queueInfo(base44, fresh, 62_000) : null;
    return Response.json({ job_id: job.id, status: fresh.status, queue });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}