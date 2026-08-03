// BASE Mark — Print Layer (matching and warp estimation).
//
// Separated from extraction because the two stages fail for different reasons
// and are measured separately: extraction can be too sparse (no evidence),
// while matching can be too permissive (false attributions). This file is where
// the design either survives or dies.
//
// ── WHY A GEOMETRIC CHECK IS MANDATORY, NOT AN OPTIMIZATION ────────────────
// Print hashes are 22 bits and built purely from ratios, which is what makes
// them invariant to pitch shift and tempo stretch — and also what makes them
// far LESS discriminative than absolute (f1,f2,dt) hashing. Unrelated tracks
// collide on individual hashes routinely. Counting raw hash collisions would
// therefore produce confident nonsense.
//
// The check that separates signal from noise is geometric. For a genuine match
// the query and reference times are related linearly:
//
//     t_query = beta * t_ref + offset
//
// so the matched pairs fall on a LINE. Random collisions scatter with no
// consistent slope or offset. The fitted slope beta IS the warp factor — the
// number handed back to the spectral detector so it can invert the warp once and
// attempt a real payload recovery.
//
// ── WHY THE SCORE IS A LIFT RATIO AND NOT A VOTE COUNT ─────────────────────
// The first measured run scored on raw peak-bin votes and produced a specific,
// diagnosable artifact: every spurious match between unrelated tracks fitted a
// beta pinned at or near the bottom of the search range (0.500, 0.599, 0.671).
// That is not coincidence, it is a bias built into the statistic. The offset
// t_query - beta*t_ref has a spread that SHRINKS as beta shrinks, so at small
// beta the same scattered pairs pile into fewer bins and the peak bin count goes
// up for purely geometric reasons. Maximizing raw votes therefore systematically
// hunts for the smallest beta available.
//
// The fix is to compare the peak against what random scatter would produce AT
// THAT SAME BETA:
//
//     lift = peak_bin_votes / (pairs * OFFSET_BIN / offset_span(beta))
//
// This is scale-free, comparable across beta, and removes the small-beta pull.
// It is also the statistic an acceptance threshold can actually be calibrated
// on, which raw votes never could.
//
// ── ABSTENTION APPLIES HERE TOO ────────────────────────────────────────────
// Same discipline as the Mark Layers (BASE_MARK_FORENSIC_SPEC.md §8): a wrong
// attribution is worse than no attribution. Scores below the acceptance floor
// return no match rather than a best guess, and the floor must be calibrated
// from a measured null distribution against unrelated audio — NOT guessed here.
// The defaults below are placeholders pending that measurement.

// Hashes that occur very often in a reference are describing something generic
// (a steady tone, a repeated loop) and contribute collisions rather than
// evidence. Dropping them keeps matching cost bounded and improves specificity.
const MAX_HASH_OCCURRENCES = 40;

// Offset histogram bin. Coarse enough to absorb the ~12ms extraction time
// resolution plus interpolation jitter, fine enough that unrelated pairs do not
// pile into one bucket.
const OFFSET_BIN = 0.08; // seconds

// Search range for the warp factor. 0.5x-2.0x spans an octave either way, which
// comfortably covers every realistic pitch shift and tempo edit; anything
// outside it is a different piece of audio, not a warped copy.
const BETA_MIN = 0.5;
const BETA_MAX = 2.0;

// A candidate line needs at least this many votes to be considered at all,
// independent of its lift. Without a floor, lift can be maximized by a 2-vote
// bin in a sparse region — a high ratio built on no evidence.
const MIN_LINE_VOTES = 8;

// Calibrated from the first real-music run: 6 unrelated AI-generated masters
// (30 cross-matched unrelated pairs) against 12 warped genuine cells across 3
// tracks, 20s each.
//
//   strongest unrelated lift ............ 14.93
//   weakest ACCEPTED genuine lift ....... 22.93
//   genuine cells above 20 .............. 11 of 12
//
// 20 sits inside that gap. The one genuine cell below it (LiquidRnB, +5% stretch,
// lift 11.0) fitted a WRONG line — beta 1.879 against a true 1.05 — so rejecting
// it is the correct outcome, not a lost recovery: accepting it would have handed
// the spectral detector a warp factor off by 79%. That is abstention working as
// specified rather than a threshold compromise.
//
// The margin is only ~1.5x, which is thin. This value is good enough to gate an
// internal instrument and NOT good enough to publish a rate from — raising n
// (more tracks, more durations, codec round trips) is required first, exactly as
// with the V4 figures.
export const PROVISIONAL_MIN_VOTES = 8;
export const PROVISIONAL_MIN_LIFT = 20;

function buildIndex(refHashes) {
  const idx = new Map();
  for (const h of refHashes) {
    const arr = idx.get(h.hash);
    if (arr) arr.push(h.t);
    else idx.set(h.hash, [h.t]);
  }
  for (const [k, arr] of idx) {
    if (arr.length > MAX_HASH_OCCURRENCES) idx.delete(k);
  }
  return idx;
}

// Two-pass vote. A single fine grid over beta would multiply the pair count by
// several hundred; a coarse pass followed by a local refinement gets the same
// resolution for a fraction of the work, which matters because this has to run
// inside an edge function's CPU budget.
function vote(pairs, betas, tqRange, trRange) {
  let best = { beta: 1, offset: 0, votes: 0, lift: 0 };
  const hist = new Map();
  for (const beta of betas) {
    hist.clear();
    let peak = 0;
    let peakBin = 0;
    for (const p of pairs) {
      const bin = Math.round((p[0] - beta * p[1]) / OFFSET_BIN);
      const n = (hist.get(bin) || 0) + 1;
      hist.set(bin, n);
      if (n > peak) {
        peak = n;
        peakBin = bin;
      }
    }
    // Expected peak height under scattered collisions at THIS beta. The span
    // term is what carries the beta dependence and therefore what cancels the
    // small-beta bias.
    const span = tqRange + beta * trRange + OFFSET_BIN;
    const expected = Math.max(1e-9, (pairs.length * OFFSET_BIN) / span);
    const lift = peak / expected;
    if (peak >= MIN_LINE_VOTES && lift > best.lift) {
      best = { beta, offset: peakBin * OFFSET_BIN, votes: peak, lift };
    }
  }
  return best;
}

function logSpace(min, max, steps) {
  const out = [];
  const lo = Math.log2(min);
  const hi = Math.log2(max);
  for (let i = 0; i <= steps; i++) out.push(Math.pow(2, lo + ((hi - lo) * i) / steps));
  return out;
}

function rangeOf(pairs, i) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pairs) {
    if (p[i] < lo) lo = p[i];
    if (p[i] > hi) hi = p[i];
  }
  return Math.max(0, hi - lo);
}

export function matchPrints(queryHashes, refHashes, opts = {}) {
  const minVotes = opts.minVotes === undefined ? PROVISIONAL_MIN_VOTES : opts.minVotes;
  const minLift = opts.minLift === undefined ? PROVISIONAL_MIN_LIFT : opts.minLift;
  const empty = { votes: 0, lift: 0, score: 0, beta: 1, offset: 0, pairs: 0, accepted: false };
  if (!queryHashes.length || !refHashes.length) return empty;

  const idx = buildIndex(refHashes);
  const pairs = [];
  for (const q of queryHashes) {
    const times = idx.get(q.hash);
    if (!times) continue;
    for (const tr of times) pairs.push([q.t, tr]);
  }
  if (pairs.length < MIN_LINE_VOTES) return { ...empty, pairs: pairs.length };

  const tqRange = rangeOf(pairs, 0);
  const trRange = rangeOf(pairs, 1);

  // Coarse pass over the full range, then refine +/- one coarse step around it.
  const coarse = vote(pairs, logSpace(BETA_MIN, BETA_MAX, 40), tqRange, trRange);
  const span = Math.pow(2, 1 / 40);
  const fine = vote(
    pairs,
    logSpace(Math.max(BETA_MIN, coarse.beta / span), Math.min(BETA_MAX, coarse.beta * span), 20),
    tqRange,
    trRange,
  );
  const best = fine.lift >= coarse.lift ? fine : coarse;

  return {
    votes: best.votes,
    lift: best.lift,
    // Retained for continuity with the first measured run. It is NOT the
    // acceptance statistic — it penalizes warped queries, where most hashes
    // legitimately cannot match, so it conflates "damaged" with "unrelated".
    score: best.votes / Math.max(1, Math.min(queryHashes.length, refHashes.length)),
    beta: best.beta,
    offset: best.offset,
    pairs: pairs.length,
    // Still surfaced because a fit sitting exactly on the search boundary is
    // suspicious regardless of lift — it means the optimum may lie outside the
    // searched range, so the reported beta is a clamp, not an estimate.
    beta_at_boundary: best.beta <= BETA_MIN * 1.001 || best.beta >= BETA_MAX * 0.999,
    accepted: best.votes >= minVotes && best.lift >= minLift,
  };
}

// Rank a query against many references. Returns EVERY candidate sorted by lift
// so a benchmark can inspect the full distribution — the margin between the top
// genuine match and the best unrelated one IS the specificity measurement, and
// it disappears if only the winner is returned.
export function matchAgainstMany(queryHashes, refs, opts = {}) {
  return refs
    .map((r) => Object.assign({ id: r.id }, matchPrints(queryHashes, r.hashes, opts)))
    .sort((a, b) => b.lift - a.lift);
}