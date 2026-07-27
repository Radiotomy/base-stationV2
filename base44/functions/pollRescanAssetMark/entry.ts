import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getV2Prediction, unpackMessage } from '../../shared/baseMarkV2.ts';
import { evaluateRescan } from '../../shared/rescanFinalize.ts';

// Poll a previously fired V2 re-scan prediction (`rescanAssetMark`) to
// completion, then run the shared flag-decision logic across BOTH layers
// (the V1 result captured at fire time + the just-resolved V2 result).
// Frontend polls with assetId until `status` === 'completed'.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, predictionId } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId is required' }, { status: 400 });

    const asset = await base44.entities.UserAsset.get(assetId);
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

    const meta = asset.metadata?.rescan;
    const pid = predictionId || meta?.v2_prediction_id;
    if (!pid) return Response.json({ error: 'No V2 prediction id to poll on this asset' }, { status: 400 });

    const data = await getV2Prediction(pid);

    if (data.status === 'starting' || data.status === 'processing') {
      return Response.json({ status: 'processing', prediction_id: pid });
    }

    // Build the V2 result from the settled prediction.
    let v2Result;
    if (data.status === 'succeeded') {
      const output = data.output;
      const resultUrl = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : output?.url;
      if (!resultUrl) {
        v2Result = { detected: false, payload_hex: null, match: false, error: 'no result url' };
      } else {
        const rr = await fetch(resultUrl);
        if (!rr.ok) {
          v2Result = { detected: false, payload_hex: null, match: false, error: 'result unreadable' };
        } else {
          const v2 = await rr.json();
          const v2Reg = asset.metadata?.base_mark_v2?.payload_hex;
          if (v2.detected && Array.isArray(v2.messages) && v2.messages.length > 0) {
            const { valid, payload_hex } = unpackMessage(v2.messages[0]);
            v2Result = { detected: valid, payload_hex: valid ? payload_hex : null, match: valid && payload_hex === v2Reg };
          } else {
            v2Result = { detected: false, payload_hex: null, match: false };
          }
        }
      }
    } else {
      // failed / canceled — inconclusive (don't false-flag on infra failure)
      v2Result = { detected: false, payload_hex: null, match: false, error: data.error || data.status };
    }

    const v1Result = meta?.v1_result || null;
    const evalResult = await evaluateRescan(base44, asset, { v1: v1Result, v2: v2Result });

    // Stamp completed state so a re-poll is idempotent.
    await base44.entities.UserAsset.update(assetId, {
      metadata: {
        ...(asset.metadata || {}),
        rescan: { ...(meta || {}), status: 'completed', v2_result: v2Result, completed_at: new Date().toISOString() },
      },
    });

    return Response.json({
      status: 'completed',
      prediction_id: pid,
      results: { v1: v1Result, v2: v2Result },
      ...evalResult,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});