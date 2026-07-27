import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 3 — Provider Health Monitoring
 *
 * For each known provider:
 *  1. Latency test — ping a known endpoint
 *  2. Credit availability — check non-zero balance
 *  3. Error rate — sample recent APIUsageLog entries
 *
 * Updates ProviderBalance with: health_status, latency_ms, success_rate,
 * score, last_health_check.
 */

const PROVIDERS = [
  { name: "sonic", endpoint: "https://api.aimusicapi.ai/api/v1/get-credits", envKey: "SONIC_API_KEY", method: "GET" },
  { name: "tempcolor", endpoint: "https://platform.tempolor.com/api/v1/balance", envKey: "TEMPCOLOR_API_KEY" },
  { name: "ltx", endpoint: null, envKey: "LTX_API_KEY" },
];

const HEALTH_WEIGHTS = { healthy: 100, degraded: 60, offline: 0, unknown: 50 };
const COST_WEIGHTS = { sonic: 0.8, tempcolor: 1.2, ltx: 1.5 };

function computeScore({ latency_ms, success_rate, balance, health_status, status }) {
  const cost = COST_WEIGHTS[arguments[0]?.provider] ?? 1.0;
  const costScore = Math.max(0, 100 - cost * 30);
  const latencyScore = Math.max(0, 100 - Math.min(100, (latency_ms ?? 1500) / 30));
  const successScore = (success_rate ?? 0.9) * 100;
  const balanceScore = (balance ?? 0) > 0 ? Math.min(100, balance) : 20;
  const healthScore = HEALTH_WEIGHTS[health_status || 'unknown'];
  const statusScore = status === 'active' ? 100 : status === 'inactive' ? 30 : 0;
  return Math.round(
    costScore * 0.15 + latencyScore * 0.20 + successScore * 0.25 +
    balanceScore * 0.10 + healthScore * 0.20 + statusScore * 0.10
  );
}

async function pingProvider(provider, apiKey) {
  if (!provider.endpoint) {
    return { latency_ms: null, ok: !!apiKey };
  }
  const start = Date.now();
  try {
    const res = await fetch(provider.endpoint, {
      method: provider.method || "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    return { latency_ms: Date.now() - start, ok: res.ok };
  } catch {
    return { latency_ms: Date.now() - start, ok: false };
  }
}

async function getRecentSuccessRate(base44, providerName) {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const logs = await base44.asServiceRole.entities.APIUsageLog.filter(
      { provider: providerName }, '-timestamp', 50
    );
    const recent = logs.filter(l => !l.timestamp || l.timestamp >= since);
    if (recent.length === 0) return 0.95; // optimistic default for cold start
    const successes = recent.filter(l => l.status === 'success').length;
    return successes / recent.length;
  } catch {
    return 0.9;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only (scheduled automations invoke with platform auth context)
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const results = [];

    for (const p of PROVIDERS) {
      const apiKey = Deno.env.get(p.envKey) || "";
      const { latency_ms, ok } = await pingProvider(p, apiKey);
      const success_rate = await getRecentSuccessRate(base44, p.name);

      let health_status = 'unknown';
      if (!apiKey) health_status = 'offline';
      else if (!ok) health_status = 'degraded';
      else if (latency_ms != null && latency_ms > 5000) health_status = 'degraded';
      else if (success_rate < 0.5) health_status = 'degraded';
      else health_status = 'healthy';

      // Upsert
      const existing = await base44.asServiceRole.entities.ProviderBalance.filter({ provider: p.name });
      const baseRecord = existing[0] || { provider: p.name, balance: 0, status: apiKey ? 'active' : 'inactive' };
      const score = computeScore({
        provider: p.name,
        latency_ms,
        success_rate,
        balance: baseRecord.balance,
        health_status,
        status: baseRecord.status,
      });

      const now = new Date().toISOString();
      const updates = {
        health_status,
        latency_ms: latency_ms ?? null,
        success_rate,
        score,
        last_health_check: now,
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.ProviderBalance.update(existing[0].id, updates);
      } else {
        await base44.asServiceRole.entities.ProviderBalance.create({
          provider: p.name,
          balance: 0,
          status: apiKey ? 'active' : 'inactive',
          ...updates,
        });
      }

      results.push({ provider: p.name, health_status, latency_ms, success_rate, score });
    }

    return Response.json({ success: true, providers: results, timestamp: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});