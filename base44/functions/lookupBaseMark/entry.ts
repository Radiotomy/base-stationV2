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

    const rows = await base44.asServiceRole.entities.UserAsset.filter(
      { 'metadata.base_mark.payload_hex': payloadHex.toLowerCase() },
      '-created_date',
      5
    );

    const matches = rows.map((a) => ({
      title: a.title,
      asset_type: a.asset_type,
      created_date: a.created_date,
      marked_at: a.metadata?.base_mark?.embedded_at || null,
    }));

    return Response.json({ matches });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});