import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyAudioBytes } from '../../shared/baseMarkVerify.ts';
import { confirmDetection, resolveExplanation } from '../../shared/baseMarkResolve.ts';
import { consumeRateLimit } from '../../shared/rateLimit.ts';

// Public black-box verifier for the no-login /verify page.
// Accepts a short base64 mono WAV snippet, runs it through the unified
// three-layer funnel, and returns ONLY the outcome + registry matches — never
// detection thresholds, confidence scores, or alignment data. The snippet is
// processed in memory and never stored.
//
// GPU layers (neural + drift) are gated to authenticated users: each anonymous
// miss would cold-start a GPU, and anonymous submissions are almost all misses.
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

    let user = null;
    try { user = await base44.auth.me(); } catch { /* public visitor */ }

    // Only the GPU tier is metered. An anonymous visitor already never reaches
    // it, and a signed-in user who exhausts their hourly GPU quota still gets a
    // full spectral scan rather than an error — the free layer is not rationed.
    let allowGpu = false;
    if (user) {
      const quota = await consumeRateLimit(base44, 'basemark_verify_gpu', user);
      allowGpu = quota.allowed;
    }

    let result;
    try {
      result = await verifyAudioBytes(base44, bytes, { allowGpu });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    // PHASE 2: detection and ATTRIBUTION are reported separately. `detected` is
    // the signal-level fact (a signature was recovered); `attributed` is the
    // forensic claim, and it requires the payload to resolve to exactly one
    // registered work. Collapsing the two would let an unregistered or
    // colliding payload read as proof of ownership.
    const verdict = await confirmDetection(base44, result);

    return Response.json({
      detected: result.detected,
      attributed: verdict.attributed,
      status: verdict.status,
      status_explanation: resolveExplanation(verdict.status),
      payload_hex: result.detected ? result.payload_hex : null,
      engine: result.engine,
      reason: result.detected ? result.reason : result.reason,
      // Signals to the client that a deep scan is pointless — there simply isn't
      // enough audio for any detector, re-timed or not.
      too_short: result.too_short,
      matches: verdict.matches,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});