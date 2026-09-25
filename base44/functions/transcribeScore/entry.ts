// transcribeScore — runs the Scribe score engine on one of the caller's own
// library tracks and returns a lead sheet (ABC) + MIDI. The composition
// footprint (key, chords, sections + hash) is written to the asset's COS
// provenance metadata so the on-chain anchor can include it. All engine
// components are permissively licensed, so output is commercially usable.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import {
  transcribeScore, SCORE_AUDIO_TYPES, SCORE_ENGINE, SCORE_MODEL_ID, SCORE_LICENSE,
} from '../../shared/scoreEngine.ts';
import { compositionFootprint } from '../../shared/trackMetadata.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { asset_id, melody_only } = await req.json();
    if (!asset_id) return Response.json({ error: 'asset_id is required' }, { status: 400 });

    // Resolved server-side from the caller's own library — never a caller URL.
    const asset = await base44.entities.UserAsset.get(asset_id).catch(() => null);
    if (!asset) return Response.json({ error: 'Track not found' }, { status: 404 });
    if (asset.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!SCORE_AUDIO_TYPES.includes(asset.asset_type)) {
      return Response.json({ error: 'Only audio assets can be transcribed' }, { status: 400 });
    }
    if (!/^https:\/\//.test(asset.file_url || '')) {
      return Response.json({ error: 'This track has no downloadable audio file' }, { status: 400 });
    }

    let out;
    try {
      out = await transcribeScore(asset.file_url, { melodyOnly: !!melody_only, title: asset.title });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }

    const footprint = await compositionFootprint(out.summary || {});
    const composition = {
      ...footprint,
      abc: String(out.abc || '').slice(0, 60000),
      abc_error: out.abc_error || null,
      melody_only: !!melody_only,
      engine: SCORE_ENGINE,
      model_id: SCORE_MODEL_ID,
      model_license: SCORE_LICENSE,
      warnings: Array.isArray(out.warnings) ? out.warnings.slice(0, 10) : [],
      transcribed_at: new Date().toISOString(),
    };

    await base44.entities.UserAsset.update(asset.id, {
      metadata: { ...(asset.metadata || {}), composition },
    });

    const { abc, ...compositionSummary } = composition;
    return Response.json({
      asset_id: asset.id,
      abc: out.abc || '',
      abc_error: out.abc_error || null,
      midi: out.midi || null,
      composition: compositionSummary,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}