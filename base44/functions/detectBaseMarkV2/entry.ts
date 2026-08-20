import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { unpackMessage, runV2, BASE_MARK_V2_VERSION } from '../../shared/baseMarkV2.ts';
import { resolvePayload, resolveExplanation } from '../../shared/baseMarkResolve.ts';
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
    let unpacked = null;
    if (detected && Array.isArray(result.messages) && result.messages.length > 0) {
      unpacked = await unpackMessage(result.messages[0]);
      const { valid, payload_hex } = unpacked;
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

    // PHASE 2: resolution runs through the single gate, so a payload that is
    // unregistered, shared by two assets, or arrives in a legacy format the
    // named asset was never marked under yields NO attribution here either.
    // Passing the unpack flags through is what carries the legacy corroboration
    // requirement into resolution instead of dropping it at the detector.
    let verdict = { attributed: false, status: 'not_detected', matches: [], asset: null };
    if (detected && payloadHex) {
      verdict = await resolvePayload(base44, {
        payload_hex: payloadHex,
        payload_version: unpacked?.payload_version,
        requires_registry_corroboration: unpacked?.requires_registry_corroboration,
      });
    }
    const matches = verdict.attributed
      ? verdict.matches.map((m) => ({
          ...m,
          mark_generation: verdict.asset?.metadata?.base_mark_v2 ? 'v2' : 'v1',
          is_own: verdict.asset?.user_id === user.id,
        }))
      : [];

    return Response.json({
      detected,
      attributed: verdict.attributed,
      status: verdict.status,
      status_explanation: resolveExplanation(verdict.status),
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