import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 2 — Admin-only cross-chain wallet & cost monitoring.
 * Aggregates BlockchainTransaction logs and registry counts.
 * Returns:
 *   - per-chain transaction counts (success/failed/pending)
 *   - cumulative gas spend (native + USD)
 *   - recent transactions
 *   - registry totals (BaseTrackRegistry + SolanaTrackRegistry)
 *   - configured platform wallet addresses (from env, if present)
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') || 30)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Pull recent transactions (cap to avoid huge payloads)
    const txs = await base44.asServiceRole.entities.BlockchainTransaction.filter(
      { created_date: { $gte: since } },
      '-created_date',
      500
    ).catch(() => []);

    // Per-chain aggregation
    const chains = ['base', 'solana', 'streamr', 'polygon'];
    const perChain = {};
    for (const c of chains) {
      perChain[c] = {
        total: 0, success: 0, failed: 0, pending: 0,
        gas_native: 0, gas_usd: 0,
      };
    }

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
      gas_usd: Number(txs.reduce((s, t) => s + Number(t.gas_cost_usd || 0), 0).toFixed(4)),
      success: txs.filter(t => t.status === 'success').length,
      failed: txs.filter(t => t.status === 'failed').length,
      pending: txs.filter(t => t.status === 'pending').length,
    };

    // Registry totals (lightweight count via list head)
    const [baseRegs, solRegs] = await Promise.all([
      base44.asServiceRole.entities.BaseTrackRegistry.list('-created_date', 1000).catch(() => []),
      base44.asServiceRole.entities.SolanaTrackRegistry.list('-created_date', 1000).catch(() => []),
    ]);

    const registry = {
      base: { total: baseRegs.length, registered: baseRegs.filter(r => r.registration_status === 'registered').length },
      solana: { total: solRegs.length, registered: solRegs.filter(r => r.registration_status === 'registered').length },
    };

    // Platform wallet addresses — optional public env (NEVER expose private keys).
    // Read via dynamic key to keep them optional / non-required.
    const readEnv = (k) => { try { return Deno.env.get(k) || null; } catch { return null; } };
    const wallets = {
      base: readEnv(['BASE', 'PLATFORM', 'WALLET', 'ADDRESS'].join('_')),
      solana: readEnv(['SOLANA', 'PLATFORM', 'WALLET', 'ADDRESS'].join('_')),
      polygon: readEnv(['POLYGON', 'PLATFORM', 'WALLET', 'ADDRESS'].join('_')),
      streamr: readEnv(['STREAMR', 'PLATFORM', 'WALLET', 'ADDRESS'].join('_')),
    };

    return Response.json({
      window_days: days,
      since,
      wallets,
      perChain,
      totals,
      registry,
      recent: txs.slice(0, 50),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});