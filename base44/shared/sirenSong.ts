// Siren Song (HeartMuLa) version resolution + stuck-prediction reaping.
//
// The model is rebuilt by a GitHub Actions pipeline on every push to the model
// repo's `main` branch, and each build gets a NEW Replicate version id. Pinning
// that id in a secret meant a manual secret update after every merge — so the
// backend asks Replicate for the model's latest published version at call time
// instead. SIREN_SONG_VERSION remains only as a fallback for when the models
// endpoint is unreachable; it no longer needs to be kept current.
//
// Every backend function that calls Siren Song must get its version from
// resolveSirenSongVersion() — never from the secret directly.

import { secrets } from 'base44:runtime';

// A version lookup must never be the reason a generation request hangs. The
// resolver sits in front of every Siren Song call, so an unbounded fetch here
// stalls the whole request instead of falling through to the pinned fallback.
const LOOKUP_TIMEOUT_MS = 8000;

// How long a prediction may sit in starting/processing before it is treated as
// stranded. A cold boot legitimately takes several minutes (multi-GB weights
// pull), and generation runs at RTF ~1.0 — so this ceiling is deliberately well
// above a slow-but-healthy run. Anything past it is not slow, it is stuck.
const STUCK_AFTER_MS = 20 * 60 * 1000;

function authHeaders() {
  return { Authorization: `Bearer ${secrets.get('REPLICATE_API_TOKEN')}` };
}

export async function resolveSirenSongVersion() {
  const model = secrets.get('SIREN_SONG_MODEL'); // "owner/name"

  try {
    const res = await fetch(`https://api.replicate.com/v1/models/${model}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (res.ok) {
      const data = await res.json();
      const latest = data?.latest_version?.id;
      if (latest) return latest;
    } else {
      console.warn(`Siren Song version lookup failed: HTTP ${res.status}`);
    }
  } catch (e) {
    console.warn('Siren Song version lookup failed:', e.message);
  }

  const pinned = secrets.get('SIREN_SONG_VERSION');
  if (!pinned) {
    throw new Error(
      'Could not resolve a Siren Song version: the Replicate model lookup failed ' +
      'and no SIREN_SONG_VERSION fallback is set.'
    );
  }
  console.warn('Using pinned SIREN_SONG_VERSION fallback:', pinned);
  return pinned;
}

/**
 * Cancel Siren Song predictions that have been starting/processing past the
 * stuck ceiling.
 *
 * This exists because a version that crashes in setup() is NOT a terminal
 * failure on Replicate: the worker dies, the platform restarts it, and the
 * prediction stays in "starting" retrying the boot while billing 2x-L40S time.
 * That loop only ends when something cancels it — previously a human noticing.
 *
 * Two behaviours worth knowing before changing this:
 *
 *  - A prediction with no `started_at` was never dispatched to a worker. It is
 *    queued, not running, and bills nothing. Replicate's cancel endpoint also
 *    404s on it (there is no worker to signal), so those are SKIPPED rather
 *    than reported as failures — a 404 here is normal, not an error.
 *  - Cancelling is idempotent and safe: a healthy long run is protected by the
 *    generous STUCK_AFTER_MS ceiling, not by this function being cautious.
 */
export async function cancelStuckSirenSongPredictions() {
  const model = secrets.get('SIREN_SONG_MODEL');
  const now = Date.now();
  const cancelled = [];
  const queuedSkipped = [];

  const res = await fetch('https://api.replicate.com/v1/predictions', {
    headers: authHeaders(),
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!res.ok) {
    console.warn(`Stuck-prediction sweep skipped: HTTP ${res.status}`);
    return { cancelled, queuedSkipped };
  }

  const { results = [] } = await res.json();

  for (const p of results) {
    if (p.model !== model) continue;
    if (p.status !== 'starting' && p.status !== 'processing') continue;

    const age = now - new Date(p.created_at).getTime();
    if (age < STUCK_AFTER_MS) continue;

    // Never dispatched — nothing running, nothing billing, nothing to cancel.
    if (!p.started_at) {
      queuedSkipped.push(p.id);
      continue;
    }

    const c = await fetch(`https://api.replicate.com/v1/predictions/${p.id}/cancel`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (c.ok) {
      cancelled.push(p.id);
      console.warn(`Cancelled stuck Siren Song prediction ${p.id} (age ${Math.round(age / 60000)}m)`);
    } else {
      console.warn(`Could not cancel ${p.id}: HTTP ${c.status}`);
    }
  }

  return { cancelled, queuedSkipped };
}