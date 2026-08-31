import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { finalizeStemJob } from '../../shared/stemFinalize.ts';

/**
 * File stems that were separated ON THE CREATOR'S OWN DEVICE.
 *
 * The separation already happened in the browser tab, so this endpoint does no
 * audio work — it exists so an on-device run lands in the SAME provenance path
 * as a Sever run. Reusing finalizeStemJob is the whole point: derived-asset
 * parentage, GenAI label inheritance and studio history must not depend on
 * where the model happened to execute.
 *
 * Never billed. The creator supplied the compute, so cost is 0 — and because
 * finalizeStemJob short-circuits on a zero cost, no credit row is touched at all.
 *
 * Payload: { assetId, stems: [{ stem_type, label, file_url }] }
 */

const SEPARATION_MODEL = 'htdemucs_6s_onnx';

// Only labels this engine can actually produce. A client could post anything,
// and an unrecognised label would become a permanent, wrong provenance record.
const ALLOWED = new Set(['drums', 'bass', 'other', 'vocals', 'guitar', 'piano']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, stems } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });
    if (!Array.isArray(stems) || stems.length === 0) {
      return Response.json({ error: 'stems required' }, { status: 400 });
    }

    const sourceList = await base44.entities.UserAsset.filter({ id: assetId });
    const source = sourceList[0];
    if (!source) return Response.json({ error: 'Source asset not found' }, { status: 404 });

    const files = [];
    for (const s of stems) {
      const label = String(s?.label || s?.stem_type || '');
      if (!ALLOWED.has(label)) {
        return Response.json({ error: `Unexpected stem label: ${label}` }, { status: 400 });
      }
      if (!s?.file_url || typeof s.file_url !== 'string') {
        return Response.json({ error: `Missing file for ${label}` }, { status: 400 });
      }
      // guitar and piano have no enum slot — file them as 'other' and keep the
      // true name in metadata, exactly as the Sever path does.
      const hasSlot = label === 'drums' || label === 'bass' || label === 'vocals' || label === 'other';
      files.push({ stem_type: hasSlot ? label : 'other', label, file_url: s.file_url });
    }

    const now = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'music',
      provider: 'ondevice',
      status: 'processing',
      input_data: {
        action: 'stem_separation',
        assetId,
        source_title: source.title,
        credit_cost: 0,
        executed_in: 'browser',
      },
      started_at: now,
    });

    const created = await finalizeStemJob(base44, {
      job,
      files,
      provider: 'ondevice',
      separationModel: SEPARATION_MODEL,
      cost: 0,
    });

    return Response.json({
      data: {
        job_id: job.id,
        status: 'completed',
        stems: created,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});