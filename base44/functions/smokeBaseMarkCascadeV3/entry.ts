import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { embedMark, detectMark, payloadFromId } from '../../shared/baseMark.ts';
import { packMessage, unpackMessage, startV2, getV2Prediction, decodeV2 } from '../../shared/baseMarkV2.ts';
import { startV3, getV3Prediction, slotHex } from '../../shared/baseMarkV3.ts';
import { decodeFlacToWav, isFlac } from '../../shared/flacDecoder.ts';

// Three-layer cascade smoke test: V1 (spectral DSP) -> V2 (neural) -> V3 (drift).
//
// WHY THIS EXISTS. smokeBaseMarkCascade only ever measured V1+V2. V3 has never
// been run on top of them, and there is a specific reason to expect trouble:
// V1 sprays broadband pseudo-noise at ~-24 dB below local RMS, and a large share
// of that energy lands in 0-8 kHz — exactly the band WavMark uses as its carrier.
// So the open question is not "does V3 work", it is "does V3 still decode with
// V1's noise sitting on top of its carrier, and does V3's delta cost V1 any
// detector margin". Nobody has measured either. Until this passes, V3 must not
// touch canonical audio.
//
// ORDER IS FORCED: V1 -> V2 -> V3. V1 must never be applied after V3, because
// that would be dumping broadband noise directly onto V3's band. V3 is last.
//
// Stepped, because V2 and V3 are both async Replicate jobs that cold-start:
//   start           -> synth audio, embed V1, measure V1 alone, kick off V2
//   poll_v2         -> when V2 lands: measure V1 on V1+V2, kick off V3 encode
//   poll_v3         -> when V3 lands: measure V1 on V1+V2+V3, kick off V3 decode
//   poll_v3_decode  -> V3 slot recovery + inline V2 decode = final verdict

function synthesizeTestWav(seconds = 12, sampleRate = 44100) {
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

// V3's 16-bit slot is a POINTER, not the 32-bit payload — the payload does not
// fit in WavMark's 16 usable bits. For the test we derive it deterministically
// from the low half of the payload so the check is reproducible.
function slotFromPayload(payloadHex) {
  return (parseInt(payloadHex, 16) >>> 0) & 0xffff;
}

async function upload(base44, bytes, name, type) {
  const file = new File([bytes], name, { type });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return file_url;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    // Every stage spends GPU money on Replicate, so this stays admin-only —
    // unlike the V1+V2 test, which predates the V3 model entirely.
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const action = body.action || 'start';

    // ── Stage 1: V1 embed (local, free, deterministic) then kick off V2 ──
    if (action === 'start') {
      const testBytes = synthesizeTestWav();
      const payloadHex = payloadFromId(`cascade-v3-${Date.now()}`);

      const v1Bytes = embedMark(testBytes, payloadHex);
      const v1Alone = detectMark(v1Bytes);
      const v1Url = await upload(base44, v1Bytes, 'cascade3-v1.wav', 'audio/wav');

      const pred = await startV2({ action: 'encode', audio: v1Url, message: JSON.stringify(packMessage(payloadHex)) });

      return Response.json({
        phase: 'v2_encoding',
        prediction_id: pred.id,
        payload_hex: payloadHex,
        slot: slotFromPayload(payloadHex),
        // Baseline the later stages are compared against. If V1's strength drops
        // materially from here after V3 is layered on, V3 is eating V1's margin.
        v1_alone: {
          detected: v1Alone.detected,
          payload_match: v1Alone.payload_hex === payloadHex,
          mean_strength: v1Alone.mean_strength ?? null,
          strength_gate: v1Alone.strength_gate ?? null,
        },
        note: 'Call again with action:"poll_v2" plus prediction_id and payload_hex.',
      });
    }

    const { prediction_id, payload_hex } = body;
    if (!prediction_id || !payload_hex) {
      return Response.json({ error: 'prediction_id and payload_hex are required' }, { status: 400 });
    }
    const slot = slotFromPayload(payload_hex);

    // ── Stage 2: V2 landed — check V1 survived it, then layer V3 on top ──
    if (action === 'poll_v2') {
      const pred = await getV2Prediction(prediction_id);
      if (pred.status === 'starting' || pred.status === 'processing') {
        return Response.json({ phase: 'v2_encoding', status: pred.status });
      }
      if (pred.status !== 'succeeded') {
        return Response.json({ phase: 'failed', stage: 'v2_encode', status: pred.status, error: pred.error || null });
      }
      const outUrl = typeof pred.output === 'string' ? pred.output : Array.isArray(pred.output) ? pred.output[0] : pred.output?.url;
      if (!outUrl) return Response.json({ phase: 'failed', stage: 'v2_encode', error: 'V2 returned no output' });

      const dl = await fetch(outUrl);
      if (!dl.ok) return Response.json({ phase: 'failed', stage: 'v2_encode', error: 'could not download V2 output' });
      const v12Bytes = new Uint8Array(await dl.arrayBuffer());

      let v1AfterV2 = { detected: false, payload_hex: null, mean_strength: null };
      try { v1AfterV2 = detectMark(v12Bytes); } catch (e) { v1AfterV2 = { detected: false, error: e.message }; }

      const v12Url = await upload(base44, v12Bytes, 'cascade3-v1v2.wav', 'audio/wav');
      // max_seconds 0 — mark the whole clip. It is only 12s, so the output
      // upload that stalls full-length masters is a non-issue here.
      const v3 = await startV3({ audio: v12Url, mode: 'encode', slot_hex: slotHex(slot) });

      return Response.json({
        phase: 'v3_encoding',
        prediction_id: v3.id,
        payload_hex,
        slot,
        v1_after_v2: {
          detected: v1AfterV2.detected,
          payload_match: v1AfterV2.payload_hex === payload_hex,
          mean_strength: v1AfterV2.mean_strength ?? null,
        },
        v1v2_file_url: v12Url,
        note: 'Call again with action:"poll_v3" plus prediction_id and payload_hex.',
      });
    }

    // ── Stage 3: V3 landed — does V1 still resolve under all three layers? ──
    if (action === 'poll_v3') {
      const p = await getV3Prediction(prediction_id);
      if (p.status === 'starting' || p.status === 'processing') {
        return Response.json({ phase: 'v3_encoding', status: p.status });
      }
      if (p.status !== 'succeeded') {
        return Response.json({ phase: 'failed', stage: 'v3_encode', status: p.status, error: p.error || null });
      }
      const markedUrl = p.output?.audio;
      if (!markedUrl) return Response.json({ phase: 'failed', stage: 'v3_encode', error: 'V3 returned no audio', output: p.output });

      const dl = await fetch(markedUrl);
      if (!dl.ok) return Response.json({ phase: 'failed', stage: 'v3_encode', error: 'could not download V3 output' });
      const raw = new Uint8Array(await dl.arrayBuffer());

      // V3 emits FLAC; V1's detector is a RIFF-only engine, so decode locally
      // for the V1 check. The FLAC bytes themselves are what get re-uploaded for
      // the V2/V3 decodes — re-encoding through a 16-bit WAV first would add
      // quantization the real pipeline never applies.
      let wavBytes = raw;
      if (isFlac(raw)) {
        try { wavBytes = decodeFlacToWav(raw); }
        catch (e) { return Response.json({ phase: 'failed', stage: 'v3_encode', error: `FLAC decode failed: ${e.message}` }); }
      }

      let v1AfterV3 = { detected: false, payload_hex: null, mean_strength: null };
      try { v1AfterV3 = detectMark(wavBytes); } catch (e) { v1AfterV3 = { detected: false, error: e.message }; }

      const cascadedUrl = await upload(base44, raw, isFlac(raw) ? 'cascade3-final.flac' : 'cascade3-final.wav', isFlac(raw) ? 'audio/flac' : 'audio/wav');
      const dec = await startV3({ audio: cascadedUrl, mode: 'decode' });

      return Response.json({
        phase: 'v3_decoding',
        prediction_id: dec.id,
        payload_hex,
        slot,
        cascaded_file_url: cascadedUrl,
        // THE headline number for V1-vs-V3 interference.
        v1_after_v3: {
          survives_cascade: v1AfterV3.detected,
          payload_match: v1AfterV3.payload_hex === payload_hex,
          mean_strength: v1AfterV3.mean_strength ?? null,
          strength_gate: v1AfterV3.strength_gate ?? null,
        },
        v3_embed_note: p.output?.note ?? null,
        note: 'Call again with action:"poll_v3_decode" plus prediction_id, payload_hex and cascaded_file_url.',
      });
    }

    // ── Stage 4: V3 slot recovery + V2 decode = verdict ──
    if (action === 'poll_v3_decode') {
      const { cascaded_file_url } = body;
      if (!cascaded_file_url) return Response.json({ error: 'cascaded_file_url is required' }, { status: 400 });

      const p = await getV3Prediction(prediction_id);
      if (p.status === 'starting' || p.status === 'processing') {
        return Response.json({ phase: 'v3_decoding', status: p.status });
      }
      if (p.status !== 'succeeded') {
        return Response.json({ phase: 'failed', stage: 'v3_decode', status: p.status, error: p.error || null });
      }
      const scan = p.output || {};
      const expectedSlot = slotHex(slot);
      const v3Ok = scan.detected === true && scan.payload_hex === expectedSlot;

      // V2 last, inline — it is the slowest leg and only matters once the two
      // genuinely-new interactions above have been measured.
      let v2Detected = false, v2PayloadHex = null, v2Error = null;
      try {
        const out = await decodeV2(cascaded_file_url);
        const resultUrl = typeof out === 'string' ? out : Array.isArray(out) ? out[0] : out?.url;
        if (resultUrl) {
          const rr = await fetch(resultUrl);
          if (rr.ok) {
            const v2 = await rr.json();
            if (v2.detected && Array.isArray(v2.messages) && v2.messages.length > 0) {
              const u = unpackMessage(v2.messages[0]);
              if (u.valid) { v2Detected = true; v2PayloadHex = u.payload_hex; }
            }
          }
        }
      } catch (e) { v2Error = e.message; }

      const v2Ok = v2Detected && v2PayloadHex === payload_hex;

      return Response.json({
        phase: 'complete',
        cascaded_file_url,
        expected_payload_hex: payload_hex,
        expected_slot_hex: expectedSlot,
        v3_layer: {
          resolves: scan.detected === true,
          recovered_slot: scan.payload_hex ?? null,
          slot_match: v3Ok,
          confidence: scan.confidence ?? 0,
          note: scan.note ?? null,
        },
        v2_layer: { resolves: v2Detected, payload_match: v2Ok, error: v2Error },
        // Deliberately NOT a single boolean. V3 failing here means WavMark cannot
        // live under V1's noise floor and the layer needs rethinking; V1 or V2
        // failing means V3's delta broke an already-shipping layer, which is the
        // far more serious outcome. Report the V1 result from stage 3 alongside
        // these two to read the full picture.
        three_layer_viable: v3Ok && v2Ok,
      });
    }

    return Response.json({ error: 'action must be start | poll_v2 | poll_v3 | poll_v3_decode' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});