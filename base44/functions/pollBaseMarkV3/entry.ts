// BASE Mark V3 — Phase 3 entry point. Polls a Drift Layer prediction and, once
// it settles, hands it to the shared finalizer (rehost, integrity check,
// canonical promotion, slot activation).
//
// Separate from startBaseMarkV3 on purpose: a full-length encode on a cold GPU
// runs for minutes, far past a single request's budget, so the embed is started
// in one invocation and completed in another.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getV3Prediction } from '../../shared/baseMarkV3.ts';
import { finalizeV3Prediction } from '../../shared/baseMarkV3Finalize.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId is required' }, { status: 400 });

    const asset = await base44.asServiceRole.entities.UserAsset.get(assetId).catch(() => null);
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

    if (asset.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const v3 = asset.metadata?.base_mark_v3 || {};
    if (!v3.prediction_id) {
      return Response.json({ error: 'No Drift Layer run has been started for this asset' }, { status: 409 });
    }

    const pred = await getV3Prediction(v3.prediction_id);
    const result = await finalizeV3Prediction(base44, pred, asset);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});