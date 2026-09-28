import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { enqueueKits, loadSourceAndVoice, queueInfo } from '../../shared/kitsQueue.ts';

/**
 * Vocal Harmonizer — real harmonies via Kits.ai voice conversion.
 * The source take is pitch-shifted by the harmony interval and re-sung by the
 * chosen Kits voice (same or different from the lead), so the harmony layer is
 * genuinely new audio rather than a copy of the source.
 *
 * Payload: { assetId, harmonyType: '3rd'|'5th'|'octave'|'unison'|'custom', custom?: semitones, voiceModelId, below?: boolean }
 * Returns: { job_id, status, queue } — poll with pollKitsJob.
 */
const INTERVALS: Record<string, number> = { '3rd': 4, '5th': 7, octave: 12, unison: 0 };

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, harmonyType = '3rd', custom, voiceModelId, below } = await req.json();
    if (!assetId || !voiceModelId) return Response.json({ error: 'assetId and voiceModelId required' }, { status: 400 });
    if (!(harmonyType in INTERVALS) && harmonyType !== 'custom') {
      return Response.json({ error: 'harmonyType must be 3rd, 5th, octave, unison or custom' }, { status: 400 });
    }
    let shift = harmonyType === 'custom' ? Math.round(Number(custom) || 0) : INTERVALS[harmonyType];
    if (below) shift = -shift;
    shift = Math.max(-24, Math.min(24, shift));

    const { input } = await loadSourceAndVoice(base44, assetId, voiceModelId);
    const job = await enqueueKits(base44, user, 'harmony', {
      ...input,
      assetId,
      harmony_type: harmonyType,
      pitch_shift: shift,
      // Harmony layers keep the lead's phrasing: moderate strength, source dynamics.
      conversion_strength: 0.5,
      model_volume_mix: 0.3,
      context: 'vocal_harmonizer',
    });
    const fresh = (await base44.entities.GenerationJob.filter({ id: job.id }))[0] || job;
    const queue = fresh.status === 'pending' ? await queueInfo(base44, fresh, 62_000) : null;
    return Response.json({ job_id: job.id, status: fresh.status, queue });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}