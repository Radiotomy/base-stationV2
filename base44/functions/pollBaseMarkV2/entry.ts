import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getV2Prediction } from '../../shared/baseMarkV2.ts';
import { finalizeV2Prediction } from '../../shared/baseMarkV2Finalize.ts';

// Polls an in-flight BASE Mark V2 neural embed. Pass either an assetId
// (reads prediction_id from asset.metadata.base_mark_v2) or a raw
// predictionId. When the Replicate prediction completes, downloads the
// marked WAV, persists it to Base44 storage, and updates the asset.
// Returns { status: 'processing' | 'completed' | 'failed', ... }.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, predictionId } = await req.json();
    let pid = predictionId;
    let asset = null;

    if (assetId) {
      asset = await base44.entities.UserAsset.get(assetId);
      if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
      pid = pid || asset.metadata?.base_mark_v2?.prediction_id;
    }
    if (!pid) return Response.json({ error: 'predictionId or assetId required' }, { status: 400 });

    const pred = await getV2Prediction(pid);
    // Shared finalization — identical to the webhook path.
    const result = await finalizeV2Prediction(base44, pred);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});