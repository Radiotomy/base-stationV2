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

// Per-IP ceilings for the PUBLIC (unauthenticated) endpoints. These are not an
// access control — the data they serve is public by design — they exist purely
// as cost control: each call fans out to the Audius gateway on our API key, so
// an unmetered endpoint is a quota-amplification target. Set generously enough
// that a real person browsing the catalogue never notices.
export const IP_LIMITS = {
  audius_public_read: { max: 300, windowMs: 60 * 60 * 1000 },
};

export const LIMITS = {
  // A full-length drift embed is the single most expensive operation we run.
  basemark_v3_embed: { max: 10, windowMs: 60 * 60 * 1000 },
  // Verification fans out to two GPU layers on a miss, so it is capped tighter
  // than its cheapness suggests.
  basemark_verify_gpu: { max: 30, windowMs: 60 * 60 * 1000 },
  basemark_v2_embed: { max: 30, windowMs: 60 * 60 * 1000 },
  // The free song assistant. Costs the creator nothing, so the platform carries
  // every call — generous enough that drafting and re-drafting an idea a dozen
  // times never hits it, tight enough that a runaway client cannot bill us for
  // thousands of LLM calls.
  song_assist: { max: 60, windowMs: 60 * 60 * 1000 },
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

/**
 * Consume one unit of quota keyed on the CALLER'S IP rather than a user id,
 * for endpoints that are intentionally unauthenticated. Same fixed-window and
 * fail-open behaviour as consumeRateLimit — a bookkeeping failure must never
 * take the public radio player or verifier offline.
 */
export async function consumeIpRateLimit(base44, action, req) {
  const cfg = IP_LIMITS[action];
  if (!cfg) return { allowed: true, remaining: null, limit: null };

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
  const start = windowStart(cfg.windowMs);
  const bucket = `${action}:ip:${ip}`;

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
        bucket, action, user_id: `ip:${ip}`, window_start: start, count: 1,
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