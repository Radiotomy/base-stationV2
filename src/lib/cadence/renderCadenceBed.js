import { base44 } from '@/api/base44Client';
import { pollJob } from '@/lib/polling/pollJob';

/**
 * Render a Cadence bed from a chord chart typed outside Lead Sheet Studio.
 * The chords are stored as a LeadSheet first, because Cadence only plays
 * progressions the platform has recorded and hashed (that's the provenance claim).
 * Resolves to the saved UserAsset.
 */
export async function renderCadenceBed({ title, chords, bpm = 120, key = '', style, duration = 30 }) {
  const { data: saved } = await base44.functions.invoke('saveLeadSheet', {
    title, chord_chart: chords, bpm, key, time_signature: '4/4',
  });
  const sheetId = saved?.data?.id || saved?.id;
  const { data } = await base44.functions.invoke('generateBedMusicGenChord', {
    leadSheetId: sheetId, style, duration,
  });
  const jobId = data?.data?.job_id || data?.job_id;
  if (!jobId) throw new Error('Cadence did not start a render');
  const { outcome, data: res, error } = await pollJob(
    async () => (await base44.functions.invoke('pollMusicGenChordBed', { job_id: jobId })).data || {},
    'engine',
  ).promise;
  if (outcome === 'completed') return res.asset;
  if (outcome === 'failed') throw new Error(error || 'Cadence render failed');
  throw new Error('Cadence is still rendering — the bed will land in your library when it finishes.');
}