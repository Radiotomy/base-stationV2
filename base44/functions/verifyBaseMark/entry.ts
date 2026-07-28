import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { detectMark } from '../../shared/baseMark.ts';
import { decodeV2, unpackMessage } from '../../shared/baseMarkV2.ts';

// Public black-box verifier for the no-login /verify page.
// Accepts a short base64 mono WAV snippet, scans it server-side, and returns
// ONLY the outcome + registry matches — never detection thresholds, confidence
// scores, or alignment data. The snippet is processed in memory and never stored.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { fileB64 } = await req.json();
    if (!fileB64 || typeof fileB64 !== 'string') {
      return Response.json({ error: 'fileB64 is required' }, { status: 400 });
    }
    // ~30s of 16-bit mono 44.1kHz WAV is ~3.5MB base64; cap generously
    if (fileB64.length > 12_000_000) {
      return Response.json({ error: 'Audio snippet too large' }, { status: 413 });
    }

    const bin = atob(fileB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    // Layer 1 — acoustic (V1), decoded fully in memory.
    let detected = false;
    let payload_hex = null;
    let engine = null;
    let reason = null;
    let tooShort = false;

    try {
      const v1 = detectMark(bytes);
      if (v1.detected && v1.payload_hex) {
        detected = true;
        payload_hex = v1.payload_hex;
        engine = 'acoustic';
      } else {
        reason = v1.reason || null;
        tooShort = !!v1.too_short;
      }
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    // Layer 2 — neural (V2) fallback. Lossy compression that destroys the V1
    // acoustic mark is exactly the gap V2 is built to close, so when the acoustic
    // layer finds nothing we run the neural detector on the same snippet.
    // Gated to authenticated users: a GPU run + snippet upload is too costly to
    // fire on every public anonymous submission, where the overwhelming majority
    // are guaranteed misses that would cold-start a T4 each.
    let isAuthed = false;
    try { await base44.auth.me(); isAuthed = true; } catch { /* public visitor */ }

    if (!detected && isAuthed) {
      try {
        const file = new Blob([bytes], { type: 'audio/wav' });
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        // Submissions here are always short snippets cut out of a longer track,
        // so crop-robust decoding is required for the neural layer to resolve.
        const output = await decodeV2(file_url, { phaseShift: true });
        const resultUrl = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : output?.url;
        if (resultUrl) {
          const rr = await fetch(resultUrl);
          if (rr.ok) {
            const v2 = await rr.json();
            if (v2.detected && Array.isArray(v2.messages) && v2.messages.length > 0) {
              const { valid, payload_hex: ph } = unpackMessage(v2.messages[0]);
              if (valid) {
                detected = true;
                payload_hex = ph;
                engine = 'neural';
                reason = null;
              }
            }
          }
        }
      } catch {
        // V2 fallback is best-effort — a transient GPU error must never fail the
        // public verifier, which previously returned a clean V1 result alone.
      }
    }

    let matches = [];
    if (detected && payload_hex) {
      const [v1Rows, v2Rows] = await Promise.all([
        base44.asServiceRole.entities.UserAsset.filter(
          { 'metadata.base_mark.payload_hex': payload_hex }, '-created_date', 5
        ),
        base44.asServiceRole.entities.UserAsset.filter(
          { 'metadata.base_mark_v2.payload_hex': payload_hex }, '-created_date', 5
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
    }

    // Black-box response: outcome + payload + engine + public registry info only.
    return Response.json({
      detected,
      payload_hex: detected ? payload_hex : null,
      engine,
      reason: detected ? null : reason,
      // Signals to the client that a deep scan is pointless — there simply isn't
      // enough audio for any detector, re-timed or not.
      too_short: tooShort,
      matches,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});