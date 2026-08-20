import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { embedMark, parseWav, BASE_MARK_VERSION } from '../../shared/baseMark.ts';
import { derivePayloadForAsset, payloadStamp, PAYLOAD_VERSION_LEGACY } from '../../shared/baseMarkPayload.ts';
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

// How recently an asset must have been created for the unauthenticated
// automation shape to act on it.
const AUTOMATION_MAX_AGE_MS = 30 * 60 * 1000;

// How long a 'processing' claim with no prediction_id stays authoritative.
// The claim is written before the GPU call and released in the catch below,
// but a function TIMEOUT kills the isolate outright — the catch never runs and
// the claim persists forever, permanently excluding the asset from marking.
// Past this age an unfulfilled claim is treated as stale and re-attempted.
const STALE_CLAIM_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  let base44;
  let assetId;
  let claimed = false;
  try {
    base44 = createClientFromRequest(req);
    const body = await req.json();

    const isAutomation = body?.event?.entity_name === 'UserAsset';
    // Base44 automations fire WITHOUT a user session (automation runtime ==
    // direct HTTP, no JWT), so the entity-create event shape MUST be allowed
    // to proceed under service-role — gating it with base44.auth.me() would
    // 403 every new UserAsset and silently halt all watermarking. The direct
    // back-fill shape ({ assetId }) has no automation backing it, so we
    // require admin there to block external callers from triggering
    // Replicate GPU spend on arbitrary assets.
    //
    // SECURITY: the event shape is caller-supplied, so on its own it authorizes
    // nothing — anyone can post it. What keeps the unauthenticated path safe is
    // that it cannot cause work the automation would not already have done:
    // every gate below is re-derived from the STORED record (never from the
    // request body), the asset must be newly created, and the V2 slot is
    // claimed before any GPU call, so a burst of concurrent requests for one
    // asset still yields exactly one prediction.
    if (!isAutomation) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required for direct invocation' }, { status: 403 });
      }
    }
    assetId = isAutomation ? body.event.entity_id : body?.assetId;
    if (!assetId) return Response.json({ skipped: true, reason: 'No asset id' });

    // Always read the canonical record. body.data is attacker-controllable on
    // the unauthenticated path and it feeds the asset-type and idempotency
    // gates below — trusting it would let a caller simply assert eligibility.
    const data = await base44.asServiceRole.entities.UserAsset.get(assetId).catch(() => null);
    if (!data) return Response.json({ skipped: true, reason: 'Asset not found' });

    // The automation fires on CREATE, so a legitimate event always refers to a
    // just-created asset. Anything older reaching this path is a replay or an
    // enumerated id; back-filling older assets is exactly what the admin-only
    // { assetId } shape exists for.
    if (isAutomation) {
      const ageMs = Date.now() - new Date(data.created_date).getTime();
      if (!(ageMs >= 0 && ageMs < AUTOMATION_MAX_AGE_MS)) {
        return Response.json({ skipped: true, reason: 'Asset not newly created; use admin back-fill' });
      }
    }

    if (!AUDIO_TYPES.includes(data.asset_type)) {
      return Response.json({ skipped: true, reason: 'Not an audio asset' });
    }
    // Idempotency — never re-embed a track that already carries a V2 mark
    // (completed or in-flight). Legacy V1-only assets are eligible (back-fill).
    // An in-flight job is one with a real prediction_id behind it. A
    // 'processing' marker WITHOUT one is only a claim, and a claim that was
    // never fulfilled must expire — otherwise a single timed-out run strands
    // the asset permanently.
    const v2meta = data.metadata?.base_mark_v2;
    const v2status = v2meta?.status;
    if (v2status === 'completed') {
      return Response.json({ skipped: true, reason: 'Already V2-marked' });
    }
    if (v2status === 'processing') {
      const claimAge = Date.now() - new Date(v2meta.claimed_at || v2meta.embedded_at || 0).getTime();
      const isStaleClaim = !v2meta.prediction_id && claimAge > STALE_CLAIM_MS;
      if (!isStaleClaim) {
        return Response.json({ skipped: true, reason: 'Already V2-marked' });
      }
    }

    const originalUrl = data.metadata?.wav_url || data.file_url;
    if (!originalUrl) return Response.json({ skipped: true, reason: 'No file URL' });

    let safeUrl;
    try {
      safeUrl = assertSafeUrl(originalUrl);
    } catch (e) {
      return Response.json({ skipped: true, reason: 'Unsafe url: ' + e.message });
    }

    // CLAIM THE SLOT BEFORE SPENDING ANYTHING. The idempotency check above is a
    // read; with no write between it and the GPU call, N concurrent requests for
    // the same asset all read "unmarked" and all start a prediction. Writing the
    // processing marker first means the next request in bails at that check, so
    // the worst case for any single asset is one prediction. Released below if
    // the work fails.
    const baseMeta = data.metadata || {};
    await base44.asServiceRole.entities.UserAsset.update(assetId, {
      metadata: {
        ...baseMeta,
        base_mark_v2: { status: 'processing', engine: 'neural', claimed_at: new Date().toISOString() },
      },
    });
    claimed = true;

    // ── Layer 1: V1 acoustic watermark — embedded first, in-process ──────────
    // Cascade order matters: V1 must be baked into the audio BEFORE V2 is
    // layered on top, so the final file carries both signatures. If this asset
    // was already V1-marked (legacy back-fill), reuse that file as the V2 source
    // instead of re-embedding.
    let v1Info = data.metadata?.base_mark || null;
    let v2SourceUrl = safeUrl;

    // Payload derivation is now KEYED and collision-checked (Phase 1).
    //
    // The reuse branch is load-bearing, not an optimization: when a V1 layer is
    // already baked into a file we MUST carry that file's existing payload into
    // the neural layer. Deriving a fresh one would put a different identifier in
    // V2 than the one physically present in the audio, so the two layers of the
    // same asset would resolve to different registry rows — which is worse than
    // either layer alone, because it makes the cascade self-contradicting.
    const derived = v1Info?.payload_hex
      ? {
          payload_hex: v1Info.payload_hex,
          payload_version: v1Info.payload_version || PAYLOAD_VERSION_LEGACY,
          payload_salt: v1Info.payload_salt || 0,
        }
      : await derivePayloadForAsset(base44, assetId);
    const payloadHex = derived.payload_hex;

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
              ...payloadStamp(derived),
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
    const message = await packMessage(payloadHex);
    const pred = await startV2({
      action: 'encode',
      audio: v2SourceUrl,
      message: JSON.stringify(message),
    });

    // Refetch fresh so a concurrent persistExternalMedia wav_url change isn't clobbered.
    const fresh = await base44.asServiceRole.entities.UserAsset.get(assetId).catch(() => null);
    const meta = (fresh?.metadata || baseMeta);
    await base44.asServiceRole.entities.UserAsset.update(assetId, {
      metadata: {
        ...meta,
        ...(v1Info ? { base_mark: v1Info } : {}),
        base_mark_v2: {
          version: BASE_MARK_V2_VERSION,
          engine: 'neural',
          model: v2Model(),
          payload_hex: payloadHex,
          ...payloadStamp(derived),
          status: 'processing',
          prediction_id: pred.id,
          original_file_url: originalUrl,
          cascade: !!v1Info,
          embedded_at: new Date().toISOString(),
        },
      },
    });
    claimed = false; // superseded by the real record, nothing to release

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
    // Release an unfulfilled claim so a later run can retry this asset. Only
    // clears a marker with no prediction_id — never a real in-flight job.
    if (claimed && base44 && assetId) {
      try {
        const cur = await base44.asServiceRole.entities.UserAsset.get(assetId);
        const curMeta = { ...(cur?.metadata || {}) };
        if (curMeta.base_mark_v2?.status === 'processing' && !curMeta.base_mark_v2?.prediction_id) {
          delete curMeta.base_mark_v2;
          await base44.asServiceRole.entities.UserAsset.update(assetId, { metadata: curMeta });
        }
      } catch { /* best effort */ }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});