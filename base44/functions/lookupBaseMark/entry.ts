import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { resolvePayload, resolveExplanation } from '../../shared/baseMarkResolve.ts';

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

    // PHASE 2: one resolver, all three layer indexes, and abstention on a
    // payload owned by more than one asset. This endpoint previously returned up
    // to five rows as equals, which presented a collision as a list of
    // co-owners; a payload that names two works identifies neither.
    const verdict = await resolvePayload(base44, { payload_hex: payloadHex.toLowerCase() });

    return Response.json({
      matches: verdict.matches,
      attributed: verdict.attributed,
      status: verdict.status,
      status_explanation: resolveExplanation(verdict.status),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});