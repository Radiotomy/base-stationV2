import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 3 — Monthly Blockchain Audit
 * Aggregates BlockchainTransaction logs, registry growth, and ErrorLog entries
 * over the previous calendar month (or a custom window), then writes a
 * BlockchainAuditReport for admin review.
 *
 * Triggers:
 *   - Scheduled automation (monthly, 1st of each month) — invoked as service
 *   - Manual admin invocation from /admin/blockchain-wallets
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Allow scheduled (no auth) or admin-only manual calls
    const user = await base44.auth.me().catch(() => null);
    const isScheduled = !user; // automations run without app-user auth
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Default: previous calendar month (UTC)
    const now = new Date();
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const periodLabel = periodStart.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    const sinceIso = periodStart.toISOString();
    const untilIso = periodEnd.toISOString();

    // Pull data in parallel
    const [txs, errors, baseRegs, solRegs] = await Promise.all([
      base44.asServiceRole.entities.BlockchainTransaction.filter(
        { created_date: { $gte: sinceIso, $lt: untilIso } }, '-created_date', 1000
      ).catch(() => []),
      base44.asServiceRole.entities.ErrorLog.filter(
        { created_date: { $gte: sinceIso, $lt: untilIso } }, '-created_date', 500
      ).catch(() => []),
      base44.asServiceRole.entities.BaseTrackRegistry.list('-created_date', 1000).catch(() => []),
      base44.asServiceRole.entities.SolanaTrackRegistry.list('-created_date', 1000).catch(() => []),
    ]);

    // Per-chain aggregation
    const chains = ['base', 'solana', 'streamr', 'polygon'];
    const perChain = Object.fromEntries(chains.map(c => [c, {
      total: 0, success: 0, failed: 0, pending: 0, gas_native: 0, gas_usd: 0,
    }]));

    for (const tx of txs) {
      const c = perChain[tx.blockchain];
      if (!c) continue;
      c.total += 1;
      if (tx.status === 'success') c.success += 1;
      else if (tx.status === 'failed') c.failed += 1;
      else c.pending += 1;
      c.gas_native += Number(tx.gas_cost_native || 0);
      c.gas_usd += Number(tx.gas_cost_usd || 0);
    }

    const totals = {
      transactions: txs.length,
      success: txs.filter(t => t.status === 'success').length,
      failed: txs.filter(t => t.status === 'failed').length,
      pending: txs.filter(t => t.status === 'pending').length,
      gas_usd: Number(txs.reduce((s, t) => s + Number(t.gas_cost_usd || 0), 0).toFixed(4)),
    };

    // Registry growth in period
    const inPeriod = (r) => {
      const d = r.created_date ? new Date(r.created_date) : null;
      return d && d >= periodStart && d < periodEnd;
    };
    const registrations = {
      base: { new: baseRegs.filter(inPeriod).length, total: baseRegs.length },
      solana: { new: solRegs.filter(inPeriod).length, total: solRegs.length },
    };

    // Error summary
    const errorsByComponent = {};
    for (const e of errors) {
      const k = e.component || 'unknown';
      errorsByComponent[k] = (errorsByComponent[k] || 0) + 1;
    }
    const errors_summary = {
      total: errors.length,
      by_component: errorsByComponent,
      critical: errors.filter(e => e.severity === 'critical').length,
    };

    // Anomaly detection (simple thresholds)
    const anomalies = [];
    if (totals.transactions > 0) {
      const failureRate = totals.failed / totals.transactions;
      if (failureRate > 0.1) anomalies.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
    }
    if (errors_summary.critical > 0) anomalies.push(`${errors_summary.critical} critical error(s) logged`);
    for (const [chain, stats] of Object.entries(perChain)) {
      if (stats.gas_usd > 100) anomalies.push(`Unusual ${chain} gas spend: $${stats.gas_usd.toFixed(2)}`);
    }

    const report = {
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      period_label: periodLabel,
      totals,
      per_chain: perChain,
      registrations,
      errors_summary,
      anomalies,
      generated_at: new Date().toISOString(),
    };

    const created = await base44.asServiceRole.entities.BlockchainAuditReport.create(report);

    return Response.json({
      success: true,
      scheduled: isScheduled,
      report_id: created.id,
      report,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});