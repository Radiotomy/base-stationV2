import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  CURATED_CANDIDATES,
  DEEP_SCAN_BATCH,
  DEEP_SCAN_MIN_SECONDS,
  DEEP_SCAN_TOTAL,
  deepScanSeconds,
  evaluateCandidates,
  trimForDeepScan,
} from '../../shared/baseMarkSearch.ts';

// Deep scan — recovers a BASE Mark from audio that has been re-timed.
//
// Resampling and time-stretching do not erase the mark, they DESYNCHRONIZE it:
// the chip sequence is keyed to a fixed sample length, so once the time axis is
// rescaled the detector can no longer line it up. The mark is still in the file.
// This inverts the problem — instead of embedding a fourth layer that would fail
// the same way, we re-time the suspect audio by a curated set of inverse ratios
// and run the standard detector at each one.
//
// Bounded on purpose. Each invocation processes DEEP_SCAN_BATCH candidates and
// returns a cursor; the client walks the cursor to completion. An earlier
// attempt ran the whole search in one request and exceeded the CPU limit.
//
// Signed-in only: this is materially more CPU per request than the plain public
// scan, so it must not be an anonymous amplification vector.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    try {
      await base44.auth.me();
    } catch {
      return Response.json({ error: 'Sign in to run a deep scan.' }, { status: 401 });
    }

    const { fileB64, cursor = 0 } = await req.json();
    if (!fileB64 || typeof fileB64 !== 'string') {
      return Response.json({ error: 'fileB64 is required' }, { status: 400 });
    }
    if (fileB64.length > 12_000_000) {
      return Response.json({ error: 'Audio snippet too large' }, { status: 413 });
    }

    const start = Number(cursor) || 0;
    if (start < 0 || start >= DEEP_SCAN_TOTAL) {
      return Response.json({ error: 'Invalid cursor' }, { status: 400 });
    }

    const bin = atob(fileB64);
    const raw = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);

    let bytes;
    let seconds;
    try {
      seconds = deepScanSeconds(raw);
      bytes = trimForDeepScan(raw);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    // Hard evidence floor. Recovering a re-timed mark is inherently marginal, and
    // the payload gate tightens as the block count falls — measured, the same
    // +1 semitone shift that recovers at 100% from 12 seconds is rejected from 8.
    // Running anyway would burn CPU to produce a miss we couldn't stand behind.
    if (seconds < DEEP_SCAN_MIN_SECONDS) {
      return Response.json({
        detected: false,
        insufficient_audio: true,
        required_seconds: DEEP_SCAN_MIN_SECONDS,
        supplied_seconds: Number(seconds.toFixed(1)),
        matches: [],
        cursor: DEEP_SCAN_TOTAL,
        total: DEEP_SCAN_TOTAL,
        done: true,
      });
    }

    const batch = CURATED_CANDIDATES.slice(start, start + DEEP_SCAN_BATCH);
    const next = start + batch.length;

    let hit = null;
    try {
      const res = evaluateCandidates(bytes, batch);
      if (res.detected && res.payload_hex) hit = res;
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    // Registry confirmation is mandatory, not decorative. Testing many candidates
    // gives the detector many chances to produce a plausible-looking payload, so a
    // payload that matches no registered asset is treated as a false positive and
    // discarded — never surfaced as a hit.
    let matches = [];
    if (hit) {
      const [v1Rows, v2Rows] = await Promise.all([
        base44.asServiceRole.entities.UserAsset.filter(
          { 'metadata.base_mark.payload_hex': hit.payload_hex }, '-created_date', 5
        ),
        base44.asServiceRole.entities.UserAsset.filter(
          { 'metadata.base_mark_v2.payload_hex': hit.payload_hex }, '-created_date', 5
        ),
      ]);
      const seen = new Set();
      matches = [...v1Rows, ...v2Rows]
        .filter((a) => !seen.has(a.id) && seen.add(a.id))
        .slice(0, 5)
        .map((a) => ({
          title: a.title,
          asset_type: a.asset_type,
          created_date: a.created_date,
          marked_at: a.metadata?.base_mark_v2?.embedded_at || a.metadata?.base_mark?.embedded_at || null,
        }));
      if (matches.length === 0) hit = null;
    }

    return Response.json({
      detected: !!hit,
      payload_hex: hit ? hit.payload_hex : null,
      // What was done to the file, in plain language — the actionable finding.
      transform: hit ? hit.candidate_label : null,
      engine: hit ? 'acoustic_deep' : null,
      matches,
      cursor: next,
      total: DEEP_SCAN_TOTAL,
      done: !!hit || next >= DEEP_SCAN_TOTAL,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});