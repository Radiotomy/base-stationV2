// Audius → BASE Print sweep.
//
// WHAT THIS IS FOR
// Every other provenance path in this app answers "is this work ours?" about
// audio a creator handed us. This one asks the question in the opposite
// direction: it walks PUBLIC Audius releases we were never given and checks
// whether any of them acoustically resemble a work registered here. That is the
// difference between holding a provenance claim and being able to act on one.
//
// ── WHY THE PRINT LAYER AND NOT THE MARK LAYERS ────────────────────────────
// Audius serves MP3. This runtime cannot decode MP3 at all — verified by probe,
// not assumed (mp3Decode.ts) — so the V1 spectral detector, which needs PCM
// samples, has nothing to work on. Feeding it MP3 bytes would not degrade
// gracefully; it would return a confident miss on audio it never actually read,
// which is the worst possible failure for a scanner whose whole output is
// "we looked and found nothing".
//
// The Print Layer is the right tool anyway. It was built to IDENTIFY rather than
// protect: it is invariant to pitch shift and tempo stretch, survives lossy
// codecs, and its remote extractor decodes with ffmpeg so the container problem
// disappears. Heavy audio never enters this runtime.
//
// ── WHAT A HIT MAY AND MAY NOT BE CALLED ───────────────────────────────────
// A Print hit says "this strongly RESEMBLES asset X" and nothing more. It
// carries no payload, so it cannot establish authorship, and it must never be
// reported as infringement or attribution (BASE_MARK_FORENSIC_SPEC §8). Only a
// spectral recovery — seeded by this match's warp factor and confirmed against
// the asset registry — may be described that way. So findings are filed as
// `resembles_registered_work`, and the confirmation field is left explicitly
// unattempted rather than pre-filled.
//
// ── WHY OUR OWN RELEASES ARE EXCLUDED, NOT COUNTED ─────────────────────────
// Our creators publish to Audius through this app. Their releases carry our
// prints because they ARE our prints, so matching one is expected behaviour and
// filing it as a finding would bury the real hits under our own catalogue.
//
// ── COST DISCIPLINE ────────────────────────────────────────────────────────
// Each candidate costs one remote extraction, so the sweep processes a SMALL
// batch per invocation and is re-runnable. Already-scanned tracks are skipped by
// id, which is what makes repeated runs cheap and lets a schedule creep through
// trending over time instead of re-paying for the same tracks.

import { matchAgainstMany } from './basePrintMatch.ts';
import { loadReferencePrints } from './printRegistry.ts';
import { extractPrintRemote, isRemotePrintConfigured } from './printExtractRemote.ts';
import { PRINT_VERSION } from './basePrint.ts';

const APP_NAME = 'BaseStation';
const DEFAULT_DISCOVERY = 'https://discoveryprovider.audius.co';

// Enough audio for the Print Layer to fit a line, short enough that one sweep
// does not cost a fortune. The measured Print calibration ran at 20s; 45 gives
// margin for an intro that does not resemble anything.
const SCAN_SECONDS = 45;

// A match must clear BOTH gates. The lift floor is the Print Layer's own
// candidate-generation floor — deliberately permissive, because it was measured
// that NO lift threshold separates genuine warped matches from unrelated audio.
// The discriminator that actually works is the fitted geometry: genuine matches
// recover beta to within a fraction of a percent of a plausible edit, while
// spurious fits land tens of percent away. So a candidate is only filed when its
// warp is within a musically believable range.
// Replicate's documented floor is 6 predictions/minute with a burst of 1 while
// account credit is low, so candidates are spaced just over that interval.
const PREDICTION_SPACING_MS = 11000;

const MIN_LIFT = 12;
const BETA_MIN_PLAUSIBLE = 0.9;
const BETA_MAX_PLAUSIBLE = 1.12;

async function discoveryNode() {
  try {
    const r = await fetch('https://api.audius.co');
    const j = await r.json();
    return j?.data?.[0] || DEFAULT_DISCOVERY;
  } catch {
    return DEFAULT_DISCOVERY;
  }
}

/** Trending releases to consider. Read-only, public, no credentials needed. */
export async function fetchTrendingCandidates(limit = 20, genre = null) {
  const node = await discoveryNode();
  const url = new URL(`${node}/v1/tracks/trending`);
  url.searchParams.set('app_name', APP_NAME);
  url.searchParams.set('time', 'week');
  if (genre) url.searchParams.set('genre', genre);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Audius trending ${r.status}`);
  const j = await r.json();
  return (j?.data || []).slice(0, limit).map((t: any) => ({
    audius_track_id: t.id,
    audius_title: t.title,
    audius_handle: t.user?.handle || '',
    audius_artist_name: t.user?.name || t.user?.handle || '',
    audius_permalink: t.permalink || '',
    stream_url: `${node}/v1/tracks/${t.id}/stream?app_name=${APP_NAME}`,
  }));
}

/**
 * Audius track ids that are our OWN creators' releases. Read from the asset
 * records rather than inferred from a print match, because the whole point is to
 * know this BEFORE spending an extraction on it.
 */
export async function ownReleaseIds(base44: any) {
  const ids = new Set<string>();
  const [assets, anchors] = await Promise.all([
    base44.asServiceRole.entities.UserAsset.list('-created_date', 500).catch(() => []),
    base44.asServiceRole.entities.BaseTrackRegistry.list('-created_date', 300).catch(() => []),
  ]);
  for (const a of assets || []) {
    const id = a?.metadata?.audius_track_id;
    if (id) ids.add(String(id));
  }
  for (const r of anchors || []) {
    if (r?.audius_track_id) ids.add(String(r.audius_track_id));
  }
  return ids;
}

/** Track ids already examined at the current print version — never re-paid for. */
export async function alreadyScannedIds(base44: any) {
  const rows = await base44.asServiceRole.entities.AudiusSweepFinding
    .filter({ print_version: PRINT_VERSION }, '-created_date', 500)
    .catch(() => []);
  // A track that could not be read is left OUT of the skip set on purpose: the
  // container may simply have been unavailable, and permanently writing off a
  // track because of a transient outage would create a blind spot that never heals.
  return new Set(
    (rows || [])
      .filter((r: any) => r.match_status !== 'not_scannable' && r.match_status !== 'error')
      .map((r: any) => String(r.audius_track_id)),
  );
}

/**
 * Scan one candidate. Never throws — a single unreadable track must not end the
 * sweep, and the reason it failed is itself a finding worth keeping.
 */
export async function scanCandidate(candidate: any, references: any[]) {
  const base = {
    audius_track_id: String(candidate.audius_track_id),
    audius_title: candidate.audius_title || '',
    audius_handle: candidate.audius_handle || '',
    audius_artist_name: candidate.audius_artist_name || '',
    audius_permalink: candidate.audius_permalink || '',
    print_version: PRINT_VERSION,
    scanned_at: new Date().toISOString(),
  };

  // Dithered because this is the QUERY side: boundary-straddling hash variants
  // are what let a warped copy meet the reference in the same bucket.
  const extract = await extractPrintRemote(candidate.stream_url, {
    dither: true,
    maxSeconds: SCAN_SECONDS,
  });

  if (!extract.ok || !extract.hashes?.length) {
    return {
      ...base,
      match_status: 'not_scannable',
      reason: extract.reason ? `${extract.reason}${extract.detail ? `: ${extract.detail}` : ''}` : 'no_hashes',
    };
  }

  const ranked = matchAgainstMany(extract.hashes, references, { minLift: MIN_LIFT });
  const top = ranked[0];

  const plausibleWarp =
    top && top.beta >= BETA_MIN_PLAUSIBLE && top.beta <= BETA_MAX_PLAUSIBLE;

  if (!top || top.lift < MIN_LIFT || !plausibleWarp) {
    return {
      ...base,
      match_status: 'no_match',
      lift: top?.lift || 0,
      beta: top?.beta || 0,
      // Recorded so a near-miss is inspectable rather than invisible — a high
      // lift at an implausible warp is exactly the spurious-fit signature the
      // geometry gate exists to reject, and seeing it is how the gate stays honest.
      reason: top && top.lift >= MIN_LIFT && !plausibleWarp ? 'implausible_warp' : undefined,
    };
  }

  const ref = references.find((r) => r.id === top.id);
  return {
    ...base,
    match_status: 'resembles_registered_work',
    matched_asset_id: top.id,
    matched_asset_title: ref?.row?.title || '',
    matched_user_id: ref?.row?.user_id || '',
    lift: Number(top.lift.toFixed(2)),
    beta: Number(top.beta.toFixed(5)),
    inliers: top.inliers || 0,
    residual_rms: top.residual_rms ?? undefined,
    spectral_confirmed: 'not_attempted',
  };
}

/**
 * Run one batch. Returns a summary plus the rows written, so an admin sees what
 * was examined rather than only what was found.
 */
export async function runSweepBatch(
  base44: any,
  { batchSize = 3, genre = null, dryRun = false } = {},
) {
  if (!isRemotePrintConfigured()) {
    return {
      ok: false,
      reason: 'remote_print_unconfigured',
      error:
        'Audius serves MP3, which this runtime cannot decode. The sweep needs the BASE Print extraction container (BASE_PRINT_MODEL / BASE_PRINT_VERSION) to read it.',
    };
  }

  const references = await loadReferencePrints(base44, { limit: 60 });
  if (!references.length) {
    return {
      ok: false,
      reason: 'no_reference_prints',
      error: 'No reference prints are stored at the current version, so there is nothing to compare against.',
    };
  }

  const [candidates, own, seen] = await Promise.all([
    fetchTrendingCandidates(40, genre),
    ownReleaseIds(base44),
    alreadyScannedIds(base44),
  ]);

  const queue: any[] = [];
  const ownSkipped: any[] = [];
  for (const c of candidates) {
    const id = String(c.audius_track_id);
    if (seen.has(id)) continue;
    if (own.has(id)) { ownSkipped.push(c); continue; }
    queue.push(c);
    if (queue.length >= batchSize) break;
  }

  if (dryRun) {
    return {
      ok: true,
      dry_run: true,
      references: references.length,
      candidates_available: candidates.length,
      already_scanned: seen.size,
      own_releases_skipped: ownSkipped.length,
      would_scan: queue.map((c) => ({ id: c.audius_track_id, title: c.audius_title, handle: c.audius_handle })),
    };
  }

  const findings: any[] = [];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    // Space the extractions out. Replicate enforces a BURST of 1 prediction on a
    // low-credit account, so firing a batch back to back throttled two of every
    // three candidates — the sweep reported them as unreadable when the audio was
    // never the problem. Same serial discipline the high-compute generation
    // engines already follow.
    if (i > 0) await new Promise((r) => setTimeout(r, PREDICTION_SPACING_MS));
    let row;
    try {
      row = await scanCandidate(c, references);
    } catch (e: any) {
      row = {
        audius_track_id: String(c.audius_track_id),
        audius_title: c.audius_title || '',
        audius_handle: c.audius_handle || '',
        match_status: 'error',
        reason: e.message,
        print_version: PRINT_VERSION,
        scanned_at: new Date().toISOString(),
      };
    }
    try {
      await base44.asServiceRole.entities.AudiusSweepFinding.create(row);
    } catch { /* a storage failure must not lose the rest of the batch */ }
    findings.push(row);
  }

  // Our own releases are recorded once so the sweep can show WHY a trending
  // track was passed over — otherwise a skipped catalogue looks like a gap.
  for (const c of ownSkipped.slice(0, 5)) {
    if (seen.has(String(c.audius_track_id))) continue;
    try {
      await base44.asServiceRole.entities.AudiusSweepFinding.create({
        audius_track_id: String(c.audius_track_id),
        audius_title: c.audius_title || '',
        audius_handle: c.audius_handle || '',
        audius_permalink: c.audius_permalink || '',
        match_status: 'own_release',
        print_version: PRINT_VERSION,
        scanned_at: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }
  }

  return {
    ok: true,
    references: references.length,
    scanned: findings.length,
    resembles: findings.filter((f) => f.match_status === 'resembles_registered_work').length,
    no_match: findings.filter((f) => f.match_status === 'no_match').length,
    not_scannable: findings.filter((f) => f.match_status === 'not_scannable').length,
    own_releases_skipped: ownSkipped.length,
    findings,
  };
}