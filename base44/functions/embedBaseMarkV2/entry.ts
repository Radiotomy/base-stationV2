import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { payloadFromId } from '../../shared/baseMark.ts';
import { packMessage, startV2, v2Model, BASE_MARK_V2_VERSION } from '../../shared/baseMarkV2.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// BASE Mark V2 — fires a neural (SilentCipher) watermark embed on Replicate
// WITHOUT blocking, then returns immediately. The frontend polls
// `pollBaseMarkV2` (passing the assetId) until status === 'completed', at
// which point the marked WAV has been persisted and the asset updated.
// This keeps the request well under the function timeout even when the
// T4 deployment is cold-starting (which can take 2–5 minutes).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, fileUrl } = await req.json();
    let url = fileUrl;
    let asset = null;

    if (assetId) {
      asset = await base44.entities.UserAsset.get(assetId);
      if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
      url = asset.metadata?.wav_url || asset.file_url;
    }
    if (!url) return Response.json({ error: 'assetId or fileUrl is required' }, { status: 400 });

    let safeUrl;
    try {
      safeUrl = assertSafeUrl(url);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    const payloadHex = payloadFromId(assetId || url);
    const message = packMessage(payloadHex);

    // Fire the prediction — do not block on Prefer:wait (cold starts exceed
    // the function timeout). Returns a prediction id we poll separately.
    const pred = await startV2({
      action: 'encode',
      audio: safeUrl,
      message: JSON.stringify(message),
    });

    // Stamp the pending state on the asset so pollBaseMarkV2 can complete it.
    if (asset) {
      const updates = {
        metadata: {
          ...(asset.metadata || {}),
          base_mark_v2: {
            version: BASE_MARK_V2_VERSION,
            engine: 'neural',
            model: v2Model(),
            payload_hex: payloadHex,
            status: 'processing',
            prediction_id: pred.id,
            original_file_url: url,
            embedded_at: new Date().toISOString(),
          },
        },
      };
      await base44.entities.UserAsset.update(assetId, updates);
    }

    return Response.json({
      ok: true,
      status: 'processing',
      asset_id: assetId || null,
      prediction_id: pred.id,
      payload_hex: payloadHex,
      version: BASE_MARK_V2_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});