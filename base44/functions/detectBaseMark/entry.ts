import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { detectMark } from '../../shared/baseMark.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';
import { confirmDetection, resolveExplanation } from '../../shared/baseMarkResolve.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fileUrl } = await req.json();
    if (!fileUrl) return Response.json({ error: 'fileUrl is required' }, { status: 400 });

    // SSRF guard — reject non-http(s), IP-literal, loopback, and internal hosts
    let safeUrl;
    try {
      safeUrl = assertSafeUrl(fileUrl);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    const dl = await fetch(safeUrl, { redirect: 'error' });
    if (!dl.ok) return Response.json({ error: 'Could not download the audio file' }, { status: 502 });
    const bytes = new Uint8Array(await dl.arrayBuffer());

    const result = detectMark(bytes);

    // PHASE 5: attribution goes through the single gate (FORENSIC_SPEC §8.2).
    // This endpoint previously ran its own lookup against the V1 index only and
    // returned up to five rows as equals — which both MISSED assets registered
    // solely under the neural layer and presented a payload collision as a list
    // of co-owners. A payload naming two works identifies neither.
    const verdict = await confirmDetection(base44, result);
    const matches = verdict.matches.map((m) => ({
      ...m,
      // Ownership context is this scanner's whole reason to require a login, so
      // it is added here rather than in the shared projection (which feeds the
      // anonymous verifier and must stay owner-agnostic).
      is_own: verdict.asset?.user_id === user.id,
    }));

    // Never expose internal detector diagnostics (alignment offset, pilot
    // correlation thresholds) — creator-facing fields only.
    const { pilot_score: _p, sample_offset: _o, ...safe } = result;
    return Response.json({
      ...safe,
      attributed: verdict.attributed,
      status: verdict.status,
      status_explanation: resolveExplanation(verdict.status),
      matches,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});