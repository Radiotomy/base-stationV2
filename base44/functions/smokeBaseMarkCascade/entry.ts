import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { embedMark, detectMark, payloadFromId } from '../../shared/baseMark.ts';
import { packMessage, unpackMessage, startV2, getV2Prediction, runV2, V2_MAGIC_LEGACY } from '../../shared/baseMarkV2.ts';
import { derivePayload, deriveV2Tag, PAYLOAD_VERSION_KEYED } from '../../shared/baseMarkPayload.ts';

// Diagnostic: tests whether BASE Mark V1 (acoustic) and V2 (neural) survive
// being CASCADED on the same file — V1 embedded first, then V2 layered on
// top — so we can verify dual-layer watermarking is safe before relying on it.
// Two-phase (V2 embedding is async on Replicate and can cold-start for minutes):
//   action: "start" -> synthesizes test audio, embeds V1, kicks off V2 on top
//   action: "poll"  -> checks the V2 job; once settled, verifies BOTH layers
//                      still resolve on the final cascaded file

function synthesizeTestWav(seconds = 8, sampleRate = 44100) {
  const frames = seconds * sampleRate;
  const dataSize = frames * 2; // 16-bit mono
  const buf = new Uint8Array(44 + dataSize);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x52494646, false); // "RIFF"
  dv.setUint32(4, 36 + dataSize, true);
  dv.setUint32(8, 0x57415645, false); // "WAVE"
  dv.setUint32(12, 0x666d7420, false); // "fmt "
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  dv.setUint32(36, 0x64617461, false); // "data"
  dv.setUint32(40, dataSize, true);
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const s = 0.3 * Math.sin(2 * Math.PI * 220 * t) + 0.2 * Math.sin(2 * Math.PI * 440 * t);
    const v = Math.max(-1, Math.min(1, s));
    dv.setInt16(44 + i * 2, Math.round(v * 32767 * 0.8), true);
  }
  return buf;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'start';

    // ── payload_selftest — PHASE 1 EXIT GATE ──────────────────────────────────
    // Pure logic, no GPU, no upload. Asserts the three properties Phase 1 claims:
    //   1. A keyed message round-trips and is reported as keyed.
    //   2. A message whose validity byte does not match the keyed tag is
    //      REJECTED — this is the property that makes a V2 mark unmintable
    //      without the key.
    //   3. PHASE 3: a legacy-format message — the forgery anyone could build
    //      from public information — is now REJECTED outright. This assertion is
    //      deliberately inverted from its Phase 1 form (which required legacy to
    //      remain readable-but-flagged): the legacy mark records it existed to
    //      serve have all been retired, so continuing to read that format could
    //      only ever admit forgeries.
    if (action === 'payload_selftest') {
      const assetId = body.asset_id || `selftest-${Date.now()}`;
      const keyedPayload = await derivePayload(assetId);

      const keyed = await unpackMessage(await packMessage(keyedPayload));

      // A wrong tag that is deliberately not the legacy magic, so the rejection
      // is unambiguous rather than an accidental legacy match.
      const realTag = await deriveV2Tag(keyedPayload);
      let wrongTag = (realTag + 1) & 0xff;
      if (wrongTag === V2_MAGIC_LEGACY) wrongTag = (realTag + 2) & 0xff;
      const v = parseInt(keyedPayload, 16) >>> 0;
      const tampered = await unpackMessage([wrongTag, (v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);

      // The legacy forgery: unkeyed payload + published magic byte.
      const legacyPayload = payloadFromId(assetId);
      const lv = parseInt(legacyPayload, 16) >>> 0;
      const legacy = await unpackMessage([V2_MAGIC_LEGACY, (lv >>> 24) & 0xff, (lv >>> 16) & 0xff, (lv >>> 8) & 0xff, lv & 0xff]);

      const checks = {
        keyed_roundtrip:
          keyed.valid && keyed.payload_hex === keyedPayload && keyed.payload_version === PAYLOAD_VERSION_KEYED,
        keyed_payload_differs_from_legacy: keyedPayload !== legacyPayload,
        wrong_tag_rejected: !tampered.valid,
        legacy_forgery_rejected: !legacy.valid,
        keyed_not_flagged: keyed.valid && keyed.requires_registry_corroboration === false,
      };

      return Response.json({
        phase: 'payload_selftest',
        checks,
        passed: Object.values(checks).every(Boolean),
        note:
          'Phase 3 exit gate. Proves the V2 validity byte is keyed and unmintable, and that the publicly ' +
          'constructible legacy message is now rejected at the detector. Remaining known gap: REPLAY — a mark ' +
          'copied out of a genuinely registered file still resolves, because it is the real payload.',
      });
    }

    if (action === 'start') {
      const testBytes = synthesizeTestWav();
      const payloadHex = await derivePayload(`smoke-cascade-${Date.now()}`);

      // Layer 1 — embed V1 first (free, in-process, deterministic)
      const v1Bytes = embedMark(testBytes, payloadHex);
      const v1Alone = detectMark(v1Bytes);

      const v1File = new File([v1Bytes], 'cascade-v1.wav', { type: 'audio/wav' });
      const { file_url: v1MarkedUrl } = await base44.integrations.Core.UploadFile({ file: v1File });

      // Layer 2 — kick off V2 neural embed ON TOP of the V1-marked file (async)
      const message = await packMessage(payloadHex);
      const pred = await startV2({ action: 'encode', audio: v1MarkedUrl, message: JSON.stringify(message) });

      return Response.json({
        phase: 'started',
        prediction_id: pred.id,
        payload_hex: payloadHex,
        v1_marked_file_url: v1MarkedUrl,
        v1_alone_detected: v1Alone.detected,
        v1_alone_payload_match: v1Alone.payload_hex === payloadHex,
        note: 'Call again with action:"poll", prediction_id, payload_hex once the V2 job settles.',
      });
    }

    if (action === 'poll') {
      const { prediction_id, payload_hex } = body;
      if (!prediction_id || !payload_hex) {
        return Response.json({ error: 'prediction_id and payload_hex are required for poll' }, { status: 400 });
      }
      const pred = await getV2Prediction(prediction_id);
      if (pred.status === 'starting' || pred.status === 'processing') {
        return Response.json({ phase: 'processing', status: pred.status });
      }
      if (pred.status !== 'succeeded') {
        return Response.json({ phase: 'failed', status: pred.status, error: pred.error || null });
      }

      const outUrl = typeof pred.output === 'string' ? pred.output : Array.isArray(pred.output) ? pred.output[0] : pred.output?.url;
      if (!outUrl) return Response.json({ phase: 'failed', error: 'V2 model returned no output' });

      const dl = await fetch(outUrl);
      if (!dl.ok) return Response.json({ phase: 'failed', error: 'Could not download cascaded output' });
      const cascadedBytes = new Uint8Array(await dl.arrayBuffer());

      // Does the V1 layer still resolve after V2 was layered on top?
      let v1Result = { detected: false, payload_hex: null, mean_strength: null };
      try { v1Result = detectMark(cascadedBytes); } catch (e) { v1Result = { detected: false, payload_hex: null, mean_strength: null, error: e.message }; }

      // Does the V2 layer resolve on the cascaded file?
      const cascadedFile = new File([cascadedBytes], 'cascade-final.wav', { type: 'audio/wav' });
      const { file_url: cascadedUrl } = await base44.integrations.Core.UploadFile({ file: cascadedFile });
      let v2Detected = false, v2PayloadHex = null;
      try {
        const decodeOutput = await runV2({ action: 'decode', audio: cascadedUrl });
        const resultUrl = typeof decodeOutput === 'string' ? decodeOutput : Array.isArray(decodeOutput) ? decodeOutput[0] : decodeOutput?.url;
        if (resultUrl) {
          const rr = await fetch(resultUrl);
          if (rr.ok) {
            const v2 = await rr.json();
            if (v2.detected && Array.isArray(v2.messages) && v2.messages.length > 0) {
              const { valid, payload_hex } = await unpackMessage(v2.messages[0]);
              if (valid) { v2Detected = true; v2PayloadHex = payload_hex; }
            }
          }
        }
      } catch (e) { /* leave v2Detected false — surfaced via cascade_viable=false */ }

      return Response.json({
        phase: 'complete',
        cascaded_file_url: cascadedUrl,
        expected_payload_hex: payload_hex,
        v1_layer: {
          survives_cascade: v1Result.detected,
          payload_match: v1Result.payload_hex === payload_hex,
          mean_strength: v1Result.mean_strength ?? null,
        },
        v2_layer: {
          resolves: v2Detected,
          payload_match: v2PayloadHex === payload_hex,
        },
        cascade_viable: v1Result.detected && v1Result.payload_hex === payload_hex && v2Detected && v2PayloadHex === payload_hex,
      });
    }

    return Response.json({ error: 'action must be "start" or "poll"' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});