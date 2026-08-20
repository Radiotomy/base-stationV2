import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { unpackMessage, runV2, BASE_MARK_V2_VERSION } from '../../shared/baseMarkV2.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// BASE Mark V2 — neural detection via the private Replicate model.
// Resolves the recovered 40-bit message to the registry (UserAsset metadata),
// matching both V2- and V1-marked records (same 32-bit payload space).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fileUrl } = await req.json();
    if (!fileUrl) return Response.json({ error: 'fileUrl is required' }, { status: 400 });

    let safeUrl;
    try {
      safeUrl = assertSafeUrl(fileUrl);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    const output = await runV2({ action: 'decode', audio: safeUrl });
    const resultUrl = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : output?.url;
    if (!resultUrl) return Response.json({ error: 'Model returned no result' }, { status: 502 });

    const rr = await fetch(resultUrl);
    if (!rr.ok) return Response.json({ error: 'Could not read the detection result' }, { status: 502 });
    const result = await rr.json();

    let detected = !!result.detected;
    let payloadHex = null;
    let confidence = null;
    if (detected && Array.isArray(result.messages) && result.messages.length > 0) {
      const { valid, payload_hex } = await unpackMessage(result.messages[0]);
      if (valid) {
        payloadHex = payload_hex;
        confidence = Array.isArray(result.confidences) ? result.confidences[0] : null;
      } else {
        // A neural mark was found but it isn't a BASE Mark — the validity byte
        // matched neither the keyed tag nor the legacy magic.
        detected = false;
      }
    } else {
      detected = false;
    }

    let matches = [];
    if (detected && payloadHex) {
      const [v2Rows, v1Rows] = await Promise.all([
        base44.asServiceRole.entities.UserAsset.filter({ 'metadata.base_mark_v2.payload_hex': payloadHex }, '-created_date', 5),
        base44.asServiceRole.entities.UserAsset.filter({ 'metadata.base_mark.payload_hex': payloadHex }, '-created_date', 5),
      ]);
      const seen = new Set();
      matches = [...v2Rows, ...v1Rows]
        .filter((a) => !seen.has(a.id) && seen.add(a.id))
        .slice(0, 5)
        .map((a) => ({
          id: a.id,
          title: a.title,
          asset_type: a.asset_type,
          created_date: a.created_date,
          marked_at: a.metadata?.base_mark_v2?.embedded_at || a.metadata?.base_mark?.embedded_at || null,
          mark_generation: a.metadata?.base_mark_v2 ? 'v2' : 'v1',
          is_own: a.user_id === user.id,
        }));
    }

    return Response.json({
      detected,
      payload_hex: detected ? payloadHex : null,
      confidence: detected ? confidence : null,
      engine: 'neural',
      version: BASE_MARK_V2_VERSION,
      matches,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});