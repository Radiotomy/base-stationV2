import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { packMessage, startV2, v2Model, BASE_MARK_V2_VERSION } from '../../shared/baseMarkV2.ts';
import {
  derivePayload,
  derivePayloadForAsset,
  payloadStamp,
  PAYLOAD_VERSION_KEYED,
  PAYLOAD_VERSION_LEGACY,
} from '../../shared/baseMarkPayload.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';
import { selectMarkingSource, isMarkedOutputUrl } from '../../shared/baseMarkSourceGuard.ts';

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
      // Prefer a PRISTINE master. Marking one of our own outputs a second time
      // destroys both signatures and leaves the registry claiming a mark that
      // cannot be recovered (see baseMarkSourceGuard).
      const picked = selectMarkingSource(asset);
      if (!picked.url) {
        return Response.json(
          {
            error:
              picked.reason === 'no_audio_file'
                ? 'This asset has no audio file to mark.'
                : 'This asset only has already-marked copies left, so it cannot be safely re-marked. An unmarked master is needed.',
            reason: picked.reason,
          },
          { status: 409 },
        );
      }
      url = picked.url;
    }
    if (!url) return Response.json({ error: 'assetId or fileUrl is required' }, { status: 400 });
    if (isMarkedOutputUrl(url)) {
      return Response.json(
        { error: 'This audio is already a BASE Mark output; re-marking it would destroy both signatures.', reason: 'already_marked' },
        { status: 409 },
      );
    }

    let safeUrl;
    try {
      safeUrl = assertSafeUrl(url);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    // Keyed derivation (Phase 1). If a V1 layer is already baked into this
    // asset's audio, its payload wins — the neural layer has to name the same
    // identifier as the spectral layer physically present in the file, or the
    // cascade resolves to two different registry rows.
    const existingV1 = asset?.metadata?.base_mark;
    const derived = existingV1?.payload_hex
      ? {
          payload_hex: existingV1.payload_hex,
          payload_version: existingV1.payload_version || PAYLOAD_VERSION_LEGACY,
          payload_salt: existingV1.payload_salt || 0,
        }
      : assetId
        ? await derivePayloadForAsset(base44, assetId)
        : { payload_hex: await derivePayload(url), payload_salt: 0, payload_version: PAYLOAD_VERSION_KEYED };
    const payloadHex = derived.payload_hex;
    const message = await packMessage(payloadHex);

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
            ...payloadStamp(derived),
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