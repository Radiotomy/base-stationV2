import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { payloadFromId } from '../../shared/baseMark.ts';
import { packMessage, startV2, v2Model, BASE_MARK_V2_VERSION } from '../../shared/baseMarkV2.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// Automaton handler: auto-embeds a BASE Mark V2 neural watermark into newly
// created audio assets. This is the V2 successor to autoBaseMark (V1 acoustic).
//
// Two call shapes:
//   1) Entity-create automation payload: { event: { entity_name, entity_id }, data }
//   2) Direct back-fill: { assetId }
//
// Runs entirely service-role (no user session). Embedding fires asynchronously on
// Replicate (no blocking on a cold T4); the prediction id is stamped on the asset
// so the existing replicateV2Webhook finalize completes the asset when GPU settles.
const AUDIO_TYPES = ['track', 'stem', 'master', 'harmony', 'mashup', 'sfx'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const isAutomation = body?.event?.entity_name === 'UserAsset';
    const assetId = isAutomation ? body.event.entity_id : body?.assetId;
    if (!assetId) return Response.json({ skipped: true, reason: 'No asset id' });

    let data = body.data;
    if (!data) data = await base44.asServiceRole.entities.UserAsset.get(assetId);
    if (!data) return Response.json({ skipped: true, reason: 'Asset not found' });

    if (!AUDIO_TYPES.includes(data.asset_type)) {
      return Response.json({ skipped: true, reason: 'Not an audio asset' });
    }
    // Idempotency — never re-embed a track that already carries a V2 mark
    // (completed or in-flight). Legacy V1-only assets are eligible (back-fill).
    const v2status = data.metadata?.base_mark_v2?.status;
    if (v2status === 'completed' || v2status === 'processing') {
      return Response.json({ skipped: true, reason: 'Already V2-marked' });
    }

    const url = data.metadata?.wav_url || data.file_url;
    if (!url) return Response.json({ skipped: true, reason: 'No file URL' });

    let safeUrl;
    try {
      safeUrl = assertSafeUrl(url);
    } catch (e) {
      return Response.json({ skipped: true, reason: 'Unsafe url: ' + e.message });
    }

    const payloadHex = payloadFromId(assetId);
    const message = packMessage(payloadHex);

    const pred = await startV2({
      action: 'encode',
      audio: safeUrl,
      message: JSON.stringify(message),
    });

    // Refetch fresh so a concurrent persistExternalMedia wav_url change isn't clobbered.
    const fresh = await base44.asServiceRole.entities.UserAsset.get(assetId).catch(() => null);
    const meta = (fresh?.metadata || data.metadata || {});
    await base44.asServiceRole.entities.UserAsset.update(assetId, {
      metadata: {
        ...meta,
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
    });

    return Response.json({
      ok: true,
      asset_id: assetId,
      payload_hex: payloadHex,
      prediction_id: pred.id,
      status: 'processing',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});