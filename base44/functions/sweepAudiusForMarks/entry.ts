import { createClientFromRequest } from 'npm:@base44/sdk@0.8.46';
import { runSweepBatch } from '../../shared/audiusPrintSweep.ts';

/**
 * Admin-only: run one batch of the Audius → BASE Print sweep.
 *
 * ADMIN-GATED because each candidate spends a remote extraction on the platform's
 * own Replicate token, and because the findings name other people's public
 * uploads — neither is something an ordinary app user should be able to trigger.
 *
 * Payload: { batchSize?, genre?, dryRun? }
 *   dryRun reports what WOULD be scanned without paying for a single extraction,
 *   which is the only safe way to confirm the queue looks right first.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const result = await runSweepBatch(base44, {
      // Capped hard: a large batch cannot finish inside the request budget, and a
      // timeout would lose findings already paid for.
      batchSize: Math.min(Number(body.batchSize) || 3, 5),
      genre: body.genre || null,
      dryRun: Boolean(body.dryRun),
    });

    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});