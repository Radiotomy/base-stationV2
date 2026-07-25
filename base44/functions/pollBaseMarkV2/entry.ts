import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getV2Prediction, v2Model, BASE_MARK_V2_VERSION } from '../../shared/baseMarkV2.ts';

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

    if (pred.status === 'starting' || pred.status === 'processing') {
      return Response.json({ status: 'processing', prediction_id: pid });
    }

    if (pred.status === 'failed' || pred.status === 'canceled') {
      if (asset) {
        await base44.entities.UserAsset.update(assetId, {
          metadata: {
            ...(asset.metadata || {}),
            base_mark_v2: {
              ...(asset.metadata?.base_mark_v2 || {}),
              status: 'failed',
              error: pred.error || pred.status,
            },
          },
        });
      }
      return Response.json({ status: 'failed', error: pred.error || pred.status, prediction_id: pid });
    }

    // succeeded — persist the marked WAV and update the asset
    const outUrl = typeof pred.output === 'string'
      ? pred.output
      : Array.isArray(pred.output) ? pred.output[0] : pred.output?.url;
    if (!outUrl) return Response.json({ status: 'failed', error: 'Model returned no output file', prediction_id: pid });

    const dl = await fetch(outUrl);
    if (!dl.ok) return Response.json({ status: 'failed', error: 'Could not download the watermarked file from the model', prediction_id: pid });
    const file = new File([await dl.arrayBuffer()], 'basemark-v2.wav', { type: 'audio/wav' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    if (asset) {
      const usedWavSlot = !!asset.metadata?.wav_url;
      const updates = {
        metadata: {
          ...(asset.metadata || {}),
          ...(usedWavSlot ? { wav_url: file_url } : {}),
          base_mark_v2: {
            ...(asset.metadata?.base_mark_v2 || {}),
            version: BASE_MARK_V2_VERSION,
            engine: 'neural',
            model: v2Model(),
            payload_hex: asset.metadata?.base_mark_v2?.payload_hex,
            status: 'completed',
            marked_file_url: file_url,
            prediction_id: pid,
            embedded_at: asset.metadata?.base_mark_v2?.embedded_at || new Date().toISOString(),
          },
        },
      };
      if (!usedWavSlot) updates.file_url = file_url;
      await base44.entities.UserAsset.update(assetId, updates);
    }

    return Response.json({
      status: 'completed',
      payload_hex: asset?.metadata?.base_mark_v2?.payload_hex || null,
      marked_file_url: file_url,
      prediction_id: pid,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});