/**
 * Phase 3 — Provider Scoring & Fallback
 *
 * Pure helpers for ranking providers based on cost, latency, success rate,
 * balance, and health. Used both client-side (UI hints) and server-side
 * (provider routing decisions).
 */

const COST_WEIGHTS = {
  nuro: 1.0,
  sonic: 0.8,
  producer: 0.9,
  tempcolor: 1.2,
  ltx: 1.5,
};

const HEALTH_SCORE = { healthy: 100, degraded: 60, offline: 0, unknown: 50 };
const STATUS_SCORE = { active: 100, inactive: 30, error: 0 };

/**
 * Score a provider 0–100 from a ProviderBalance record.
 * Higher score = better candidate.
 */
export function scoreProvider(balanceRecord) {
  if (!balanceRecord) return 0;

  const cost = COST_WEIGHTS[balanceRecord.provider] ?? 1.0;
  const costScore = Math.max(0, 100 - cost * 30); // cheaper = higher

  const latency = balanceRecord.latency_ms ?? 1500;
  const latencyScore = Math.max(0, 100 - Math.min(100, latency / 30)); // sub-3s ideal

  const successRate = balanceRecord.success_rate ?? 0.9;
  const successScore = successRate * 100;

  const balance = balanceRecord.balance ?? 0;
  const balanceScore = balance > 0 ? Math.min(100, balance) : 20;

  const healthScore = HEALTH_SCORE[balanceRecord.health_status || 'unknown'];
  const statusScore = STATUS_SCORE[balanceRecord.status || 'active'];

  // Weighted blend
  const score =
    costScore * 0.15 +
    latencyScore * 0.20 +
    successScore * 0.25 +
    balanceScore * 0.10 +
    healthScore * 0.20 +
    statusScore * 0.10;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Given an array of candidate provider names and a map of ProviderBalance records
 * keyed by provider name, return them sorted best-first.
 */
export function rankProviders(candidates, balanceMap) {
  return candidates
    .map(name => ({
      provider: name,
      score: scoreProvider(balanceMap[name]),
      record: balanceMap[name] || null,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Build a fallback chain starting from a primary provider — picks the next
 * highest-scoring providers from the candidate list, excluding the primary.
 */
export function buildFallbackChain(primary, candidates, balanceMap) {
  const ranked = rankProviders(candidates.filter(c => c !== primary), balanceMap);
  return ranked.map(r => r.provider);
}