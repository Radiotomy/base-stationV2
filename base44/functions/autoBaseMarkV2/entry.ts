import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { embedMark, parseWav, payloadFromId, BASE_MARK_VERSION } from '../../shared/baseMark.ts';
import { isFlac, decodeFlacToWav } from '../../shared/flacDecoder.ts';
import { packMessage, startV2, v2Model, BASE_MARK_V2_VERSION } from '../../shared/baseMarkV2.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// Automation handler: applies BASE Station's CASCADED dual-layer watermark to
// every newly created audio asset.
//
//   Layer 1 — V1 acoustic (spread-spectrum DSP, embedded synchronously, free)
//   Layer 2 — V2 neural (SilentCipher on Replicate, embedded on top of the V1
//             file, async — cold GPU starts can take minutes)
//
// Cascading both layers gives forensic redundancy: V1 is cheap, deterministic
// and detectable without a GPU; V2 survives attacks (heavy lossy re-encodes,
// pitch/time-shifting) that break V1. Verified end-to-end in smokeBaseMarkCascade —
// V1 still resolves after V2 is layered on top, and vice versa.
//
// Two call shapes:
//   1) Entity-create automation payload: { event: { entity_name, entity_id }, data }
//   2) Direct back-fill: { assetId }
//
// Runs entirely service-role (no user session). V2 fires asynchronously on
// Replicate (no blocking on a cold T4); the prediction id is stamped on the asset
// so the existing replicateV2Webhook finalize completes the asset when GPU settles.
const AUDIO_TYPES = ['track', 'stem', 'master', 'harmony', 'mashup', 'sfx'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Admin-only — automations invoke with platform admin auth context; this
    // blocks unauthenticated external callers from triggering watermarking
    // (and Replicate GPU spend) on arbitrary assets.
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
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

    const originalUrl = data.metadata?.wav_url || data.file_url;
    if (!originalUrl) return Response.json({ skipped: true, reason: 'No file URL' });

    let safeUrl;
    try {
      safeUrl = assertSafeUrl(originalUrl);
    } catch (e) {
      return Response.json({ skipped: true, reason: 'Unsafe url: ' + e.message });
    }

    const payloadHex = payloadFromId(assetId);

    // ── Layer 1: V1 acoustic watermark — embedded first, in-process ──────────
    // Cascade order matters: V1 must be baked into the audio BEFORE V2 is
    // layered on top, so the final file carries both signatures. If this asset
    // was already V1-marked (legacy back-fill), reuse that file as the V2 source
    // instead of re-embedding.
    let v1Info = data.metadata?.base_mark || null;
    let v2SourceUrl = safeUrl;

    if (v1Info?.marked_file_url) {
      v2SourceUrl = v1Info.marked_file_url;
    } else {
      try {
        const dl = await fetch(safeUrl);
        if (dl.ok) {
          let bytes = new Uint8Array(await dl.arrayBuffer());
          if (isFlac(bytes)) bytes = decodeFlacToWav(bytes);
          const wav = parseWav(bytes);
          if (wav && wav.audioFormat === 1 && (wav.bitsPerSample === 16 || wav.bitsPerSample === 24)) {
            const v1Bytes = embedMark(bytes, payloadHex);
            const v1File = new File([v1Bytes], 'basemark.wav', { type: 'audio/wav' });
            const { file_url: v1Url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: v1File });
            v1Info = {
              version: BASE_MARK_VERSION,
              payload_hex: payloadHex,
              marked_file_url: v1Url,
              original_file_url: originalUrl,
              embedded_at: new Date().toISOString(),
              auto: true,
            };
            v2SourceUrl = v1Url; // cascade V2 on top of the V1-marked file
          }
          // Non-PCM sources (e.g. MP3) skip V1 silently — V2 still embeds directly.
        }
      } catch (e) {
        console.warn('V1 layer skipped, proceeding with V2 only:', e.message);
      }
    }

    // ── Layer 2: V2 neural watermark — async on Replicate, layered on top ────
    const message = packMessage(payloadHex);
    const pred = await startV2({
      action: 'encode',
      audio: v2SourceUrl,
      message: JSON.stringify(message),
    });

    // Refetch fresh so a concurrent persistExternalMedia wav_url change isn't clobbered.
    const fresh = await base44.asServiceRole.entities.UserAsset.get(assetId).catch(() => null);
    const meta = (fresh?.metadata || data.metadata || {});
    await base44.asServiceRole.entities.UserAsset.update(assetId, {
      metadata: {
        ...meta,
        ...(v1Info ? { base_mark: v1Info } : {}),
        base_mark_v2: {
          version: BASE_MARK_V2_VERSION,
          engine: 'neural',
          model: v2Model(),
          payload_hex: payloadHex,
          status: 'processing',
          prediction_id: pred.id,
          original_file_url: originalUrl,
          cascade: !!v1Info,
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
      v1_embedded: !!v1Info,
      cascade: !!v1Info,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});