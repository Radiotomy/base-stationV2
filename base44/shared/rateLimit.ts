// Rate limiting for the GPU-backed BASE Mark paths.
//
// WHY THIS EXISTS: every V2 and V3 call starts a Replicate GPU prediction that
// costs real money and can cold-start a machine. Nothing currently stops one
// authenticated account from firing them in a loop — accidentally (a retry loop
// in a client) or deliberately. Credits cover generation, but the forensic
// paths are free to the user, so the bill lands entirely on the platform.
//
// FIXED WINDOWS, NOT SLIDING. A sliding window needs per-call timestamps and a
// read of all of them on every request. A fixed window is one row and one
// increment. The tradeoff is a burst at a window boundary can reach up to 2x
// the limit; for cost control on a handful of calls per hour that is fine, and
// the alternative costs more to run than it saves.
//
// FAIL-OPEN, DELIBERATELY. If the counter itself errors, the call proceeds.
// A limiter outage must not take down watermarking — the failure mode we are
// protecting against is expensive, not dangerous, and silently blocking every
// creator's marking because a bookkeeping write failed is the worse outcome.

export const LIMITS = {
  // A full-length drift embed is the single most expensive operation we run.
  basemark_v3_embed: { max: 10, windowMs: 60 * 60 * 1000 },
  // Verification fans out to two GPU layers on a miss, so it is capped tighter
  // than its cheapness suggests.
  basemark_verify_gpu: { max: 30, windowMs: 60 * 60 * 1000 },
  basemark_v2_embed: { max: 30, windowMs: 60 * 60 * 1000 },
};

function windowStart(windowMs) {
  return new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
}

/**
 * Consume one unit of quota.
 * Returns { allowed, remaining, retry_after_seconds, limit }.
 * Admins are never limited — they run the benchmarks and back-fills that these
 * ceilings exist to keep ordinary accounts away from.
 */
export async function consumeRateLimit(base44, action, user) {
  const cfg = LIMITS[action];
  if (!cfg || !user) return { allowed: true, remaining: null, limit: null };
  if (user.role === 'admin') return { allowed: true, remaining: null, limit: null, exempt: true };

  const start = windowStart(cfg.windowMs);
  const bucket = `${action}:${user.id}`;

  try {
    const rows = await base44.asServiceRole.entities.RateLimitCounter.filter(
      { bucket, window_start: start }, '-created_date', 1,
    );
    const row = rows?.[0];
    const used = row?.count || 0;

    if (used >= cfg.max) {
      const resetsAt = new Date(start).getTime() + cfg.windowMs;
      return {
        allowed: false,
        remaining: 0,
        limit: cfg.max,
        retry_after_seconds: Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)),
      };
    }

    if (row) {
      await base44.asServiceRole.entities.RateLimitCounter.update(row.id, { count: used + 1 });
    } else {
      await base44.asServiceRole.entities.RateLimitCounter.create({
        bucket, action, user_id: user.id, window_start: start, count: 1,
      });
    }
    return { allowed: true, remaining: cfg.max - used - 1, limit: cfg.max };
  } catch {
    return { allowed: true, remaining: null, limit: cfg.max, degraded: true };
  }
}

/** Standard 429 for a refused call. */
export function rateLimitResponse(result, action) {
  return Response.json({
    error: 'Rate limit reached',
    message: `You have used all ${result.limit} ${action.replace(/_/g, ' ')} runs available this hour. Try again in about ${Math.ceil((result.retry_after_seconds || 60) / 60)} minute(s).`,
    retry_after_seconds: result.retry_after_seconds,
  }, { status: 429, headers: { 'Retry-After': String(result.retry_after_seconds || 60) } });
}