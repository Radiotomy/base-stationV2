// Shared polling policy for every long-running job in the app.
//
// WHY THIS EXISTS: each studio had grown its own recursive setTimeout loop with
// a hardcoded flat interval — 5s in the bed and stem panels, 15s in the generic
// music hook. Two problems came out of that.
//
// 1. Rate pressure. Every client tick becomes exactly one provider API call
//    (our poll function forwards to Sonic / an HF Space / Replicate). A flat 5s
//    loop asks a provider 120 times for a render that takes 90 seconds, and it
//    does that per open tab. Nothing about asking more often makes a GPU finish
//    sooner — it only spends quota and, on a single-worker HF Space, competes
//    with the render itself.
// 2. Wrong shape. A flat interval is simultaneously too slow at the start
//    (a 20s job waited a full 15s to be noticed) and too fast in the long tail
//    (a 4-minute Sonic render gets asked 48 pointless times).
//
// So the delay ramps: ask promptly at first, then back off toward a calm ceiling
// and sit there. And the giving-up rule is a wall-clock DEADLINE rather than an
// attempt count — with backoff, "60 attempts" no longer means a knowable amount
// of time, and a deadline is the thing anyone actually reasons about.
//
// Giving up here only stops WATCHING. The job keeps running server-side and
// finalizes into the library on its own, so a deadline is never data loss.

export const POLL_PROFILES = {
  // Hosted music providers (Sonic, Producer, Tempolor). Multi-take renders of a
  // full song legitimately run several minutes.
  music: { firstDelayMs: 6000, maxDelayMs: 20000, deadlineMs: 15 * 60 * 1000 },
  // Our own HF Space engines (Cadence, Cantor, Sever). They render one job at a
  // time, so a queued job waits behind another creator's — hence the long
  // deadline, but a calm cadence, because polling a busy Space cannot help it.
  engine: { firstDelayMs: 4000, maxDelayMs: 15000, deadlineMs: 12 * 60 * 1000 },
};

const GROWTH = 1.6;

/**
 * Polls until the job settles, then resolves with the final payload.
 *
 * `pollOnce` must return an object carrying a `status` of 'completed' | 'failed'
 * (anything else is treated as still running). A THROWN error is treated as
 * still running too: a transient network blip or a warming Space must never be
 * reported to a creator as a failed render.
 *
 * Resolves { outcome: 'completed', data } | { outcome: 'failed', error }
 *          | { outcome: 'timeout' } when the deadline passes.
 * Returns a `cancel()` alongside so an unmounting page stops polling.
 */
export function pollJob(pollOnce, profileName = 'engine') {
  const profile = POLL_PROFILES[profileName] || POLL_PROFILES.engine;
  let timer = null;
  let cancelled = false;
  const startedAt = Date.now();
  let delay = profile.firstDelayMs;

  const promise = new Promise((resolve) => {
    const tick = async () => {
      if (cancelled) return;

      if (Date.now() - startedAt > profile.deadlineMs) {
        resolve({ outcome: 'timeout' });
        return;
      }

      let result = null;
      try {
        result = await pollOnce();
      } catch {
        // Keep watching — see the note above on transient failures.
      }
      if (cancelled) return;

      if (result?.status === 'completed') {
        resolve({ outcome: 'completed', data: result });
        return;
      }
      if (result?.status === 'failed') {
        resolve({ outcome: 'failed', error: result.error || result.error_message });
        return;
      }

      delay = Math.min(Math.round(delay * GROWTH), profile.maxDelayMs);
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, profile.firstDelayMs);
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      clearTimeout(timer);
    },
    elapsedMs: () => Date.now() - startedAt,
  };
}