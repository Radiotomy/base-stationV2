import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { detectMark } from '../../shared/baseMark.ts';

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

    let result;
    try {
      result = detectMark(bytes);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    let matches = [];
    if (result.detected && result.payload_hex) {
      const rows = await base44.asServiceRole.entities.UserAsset.filter(
        { 'metadata.base_mark.payload_hex': result.payload_hex },
        '-created_date',
        5
      );
      matches = rows.map((a) => ({
        title: a.title,
        asset_type: a.asset_type,
        created_date: a.created_date,
        marked_at: a.metadata?.base_mark?.embedded_at || null,
      }));
    }

    // Black-box response: outcome + payload + public registry info only.
    return Response.json({
      detected: result.detected,
      payload_hex: result.detected ? result.payload_hex : null,
      reason: result.reason || null,
      matches,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});