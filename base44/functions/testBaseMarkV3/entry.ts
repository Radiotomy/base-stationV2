import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { encodeV3, decodeV3, slotHex, BASE_MARK_V3_VERSION, v3Model, v3Version } from '../../shared/baseMarkV3.ts';
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
// It embeds, decodes the result, and reports what came back.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { fileUrl, slot = 1 } = await req.json();
    if (!fileUrl) return Response.json({ error: 'fileUrl is required' }, { status: 400 });

    let safeUrl;
    try {
      safeUrl = assertSafeUrl(fileUrl);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    const expected = slotHex(slot);
    const embed = await encodeV3(safeUrl, slot);
    const markedUrl = embed?.audio;
    if (!markedUrl) {
      return Response.json({ error: 'Drift Layer returned no marked audio', embed }, { status: 502 });
    }

    const scan = await decodeV3(markedUrl);

    return Response.json({
      ok: true,
      version: BASE_MARK_V3_VERSION,
      model: v3Model(),
      pinned_version: v3Version(),
      expected_slot: expected,
      recovered_slot: scan?.payload_hex ?? null,
      // The pass/fail that matters: the slot survived the band-split round trip.
      survived: scan?.detected === true && scan?.payload_hex === expected,
      confidence: scan?.confidence ?? 0,
      // Master integrity — output must come back at the SAME rate and channel
      // count it went in at. A mismatch means the delta path resampled the
      // master and the layer must not be promoted.
      master_preserved:
        embed?.sample_rate === scan?.sample_rate && embed?.channels === scan?.channels,
      sample_rate: embed?.sample_rate ?? null,
      channels: embed?.channels ?? null,
      marked_file_url: markedUrl,
      embed_note: embed?.note ?? null,
      scan_note: scan?.note ?? null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});