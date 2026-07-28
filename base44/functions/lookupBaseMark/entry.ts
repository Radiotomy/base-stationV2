import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Public registry lookup for the no-login BASE Mark verifier.
// Takes a detected 8-hex-char payload and returns minimal, non-sensitive
// info about matching registered tracks. No auth required by design.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { payloadHex } = await req.json();
    if (!/^[0-9a-f]{8}$/i.test(payloadHex || '')) {
      return Response.json({ error: 'payloadHex must be 8 hex characters' }, { status: 400 });
    }

    // Both layers carry the SAME 32-bit registry payload, so a lookup must check
    // both. Searching only the V1 key silently failed to resolve any asset whose
    // spectral layer had been stripped or that resolved via the neural layer —
    // the exact case the second layer exists to cover.
    const hex = payloadHex.toLowerCase();
    const [v1Rows, v2Rows] = await Promise.all([
      base44.asServiceRole.entities.UserAsset.filter(
        { 'metadata.base_mark.payload_hex': hex }, '-created_date', 5
      ),
      base44.asServiceRole.entities.UserAsset.filter(
        { 'metadata.base_mark_v2.payload_hex': hex }, '-created_date', 5
      ),
    ]);

    const seen = new Set();
    const matches = [...v1Rows, ...v2Rows]
      .filter((a) => !seen.has(a.id) && seen.add(a.id))
      .slice(0, 5)
      .map((a) => ({
        title: a.title,
        asset_type: a.asset_type,
        created_date: a.created_date,
        marked_at: a.metadata?.base_mark_v2?.embedded_at || a.metadata?.base_mark?.embedded_at || null,
      }));

    return Response.json({ matches });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});