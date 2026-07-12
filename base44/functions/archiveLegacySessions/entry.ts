import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 2 — Weekly Legacy Session Archival
 *
 * Marks LiveSessions as 'archived' when they have been in 'completed' status
 * for more than 30 days. Keeps the active session list lean for the UI.
 *
 * Triggers:
 *   - Scheduled automation (weekly)
 *   - Manual admin invocation
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only (scheduled automations invoke with platform auth context)
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    const cutoffIso = cutoff.toISOString();

    // Pull completed sessions older than cutoff (capped to avoid runaway loads)
    const stale = await base44.asServiceRole.entities.LiveSession.filter(
      { status: 'completed', updated_date: { $lt: cutoffIso } },
      '-updated_date',
      500
    ).catch(() => []);

    let archived = 0;
    const errors = [];

    for (const session of stale) {
      try {
        await base44.asServiceRole.entities.LiveSession.update(session.id, { status: 'archived' });
        archived += 1;
      } catch (err) {
        errors.push({ id: session.id, error: err.message });
      }
    }

    return Response.json({
      success: true,
      scanned: stale.length,
      archived,
      errors,
      cutoff: cutoffIso,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});