import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { startV3, getV3Prediction, slotHex, BASE_MARK_V3_VERSION, v3Model, v3Version } from '../../shared/baseMarkV3.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// BASE Mark V3 — band-split survival test.
//
// Admin-only. Proves the ONE thing that is unverified about the Drift Layer
// before it is allowed anywhere near canonical audio: that a slot embedded as a
// low-band delta, resampled back up and added to the untouched master, still
// decodes. Recombination is lossless in the low band in theory, but band-edge
// resampling ripple could cost bit recovery — so we measure instead of assuming.
//
// It deliberately does NOT write to any asset or promote anything to canonical.
//
// STEPPED, NOT BLOCKING. A GPU cold start plus an encode AND a decode of a
// full-length master does not fit in one request — measured: 300s timeout on a
// 4-minute WAV. So each call advances one step and returns a cursor:
//   1. { fileUrl, slot }                     -> starts encode, returns predictionId
//   2. { stage:'encode', predictionId, slot } -> when encode lands, starts decode
//   3. { stage:'decode', predictionId, slot, embed } -> final survival report
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // maxSeconds bounds the encode to the first N seconds so a test run is
    // fast and measurable; 0 marks the whole master.
    const { fileUrl, slot = 1, stage, predictionId, embed, maxSeconds = 0, modelVersion } = await req.json();
    const expected = slotHex(slot);
    const useVersion = modelVersion || v3Version();
    const meta = { version: BASE_MARK_V3_VERSION, model: v3Model(), pinned_version: useVersion, expected_slot: expected };

    // ── Step 1: start the encode ──
    if (!stage) {
      if (!fileUrl) return Response.json({ error: 'fileUrl is required' }, { status: 400 });
      let safeUrl;
      try {
        safeUrl = assertSafeUrl(fileUrl);
      } catch (e) {
        return Response.json({ error: e.message }, { status: 400 });
      }
      const p = await startV3({ audio: safeUrl, mode: 'encode', slot_hex: expected, max_seconds: maxSeconds }, useVersion);
      return Response.json({ ...meta, stage: 'encode', predictionId: p.id, status: p.status, done: false });
    }

    if (!predictionId) return Response.json({ error: 'predictionId is required' }, { status: 400 });
    const p = await getV3Prediction(predictionId);

    if (p.status === 'starting' || p.status === 'processing') {
      return Response.json({ ...meta, stage, predictionId, status: p.status, done: false });
    }
    if (p.status !== 'succeeded') {
      return Response.json({ ...meta, stage, status: p.status, error: p.error || 'prediction failed' }, { status: 502 });
    }

    // ── Step 2: encode landed — hand the marked audio to a decode run ──
    if (stage === 'encode') {
      const markedUrl = p.output?.audio;
      if (!markedUrl) {
        return Response.json({ ...meta, error: 'Drift Layer returned no marked audio', output: p.output }, { status: 502 });
      }
      const next = await startV3({ audio: markedUrl, mode: 'decode' }, useVersion);
      return Response.json({
        ...meta,
        stage: 'decode',
        predictionId: next.id,
        status: next.status,
        done: false,
        marked_file_url: markedUrl,
        // Passed back on the next call so the final report can compare the
        // master's rate/channels before and after.
        embed: { sample_rate: p.output?.sample_rate, channels: p.output?.channels, note: p.output?.note },
      });
    }

    // ── Step 3: decode landed — the survival report ──
    const scan = p.output || {};
    return Response.json({
      ...meta,
      ok: true,
      done: true,
      recovered_slot: scan.payload_hex ?? null,
      // The pass/fail that matters: the slot survived the band-split round trip.
      survived: scan.detected === true && scan.payload_hex === expected,
      confidence: scan.confidence ?? 0,
      // Master integrity — output must come back at the SAME rate and channel
      // count it went in at. A mismatch means the delta path resampled the
      // master and the layer must not be promoted.
      master_preserved: embed ? embed.sample_rate === scan.sample_rate && embed.channels === scan.channels : null,
      sample_rate: scan.sample_rate ?? null,
      channels: scan.channels ?? null,
      embed_note: embed?.note ?? null,
      scan_note: scan.note ?? null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});