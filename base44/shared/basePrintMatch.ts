// TRADE SECRET — BASE Station proprietary and confidential. Server-side only.
// Do not copy, publish, redistribute or import into client code.
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

// MEASURED, and the measurement overturned the first calibration. Widening from
// 3 tracks to 6 (20s each, 30 cross-matched unrelated pairs) collapsed the gap
// that a lift-20 gate depended on:
//
//   strongest unrelated lift .................... 14.93
//   AnalogHouse +2 semitones, beta error -0.06% .. 14.87  <-- genuine, rejected
//   AnalogHouse 44.1->48kHz, beta error -0.02% ... 16.20  <-- genuine, rejected
//
// Those two cells estimated the warp factor to within a quarter of one percent
// and still scored at or below the null ceiling. The distributions overlap, so
// NO lift threshold separates genuine warped matches from unrelated audio. The
// ~1.5x margin seen at n=3 was a small-sample artifact — the same trap the V4
// figures are annotated against, and the reason n gets raised before publishing.
//
// What the wider run DID establish is more useful than a threshold: beta accuracy
// is bimodal and unambiguous. Every genuine cell recovered beta to within 0.25%,
// while every spurious fit was wrong by 49-79% (AnalogHouse +5% stretch fitted
// 1.569 against a true 1.05). Lift is a weak discriminator; the fitted geometry
// is a strong one.
//
// This is therefore NOT an acceptance threshold and must not be used as one. It
// is a candidate-generation floor: the Print Layer's job per
// BASE_FINGERPRINT_DESIGN.md is to propose warp factors, and the decision belongs
// to the spectral detector, which inverts the proposed beta, attempts a real
// payload recovery, and applies its own calibrated gate plus mandatory registry
// confirmation (BASE_MARK_FORENSIC_SPEC.md §8). Under that split a wrong beta
// costs one failed recovery attempt instead of producing a false attribution,
// which is why the floor is set permissively at 10 — below the 14.87 genuine cell
// this run would otherwise have thrown away.
export const PROVISIONAL_MIN_VOTES = 8;
export const PROVISIONAL_MIN_LIFT = 10;

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

// ── Inlier least-squares refit ─────────────────────────────────────────────
// The grid vote finds WHICH line the matched pairs lie on; it is a terrible way
// to measure that line's slope. Measured: the fine grid steps by
// 2^(0.05/20) = 0.173% = 1730 ppm, and the observed beta error on a 44.1->48kHz
// resample was 1562 ppm — i.e. the error WAS the grid step, not the data. The
// spectral detector's recovery window is under 5 ppm wide, so a grid-quantized
// beta is ~300x too coarse to seed a targeted retry with.
//
// So once the winning line is identified, throw the grid away and fit the slope
// properly: take the pairs sitting on that line and least-squares regress
// t_query = beta * t_ref + offset. Precision then comes from the number of
// inliers and their time span rather than from how finely we were willing to
// enumerate beta.
//
// Tolerance is tightened over successive passes. The first pass has to accept a
// full offset bin because that is all the grid localized the line to; each
// refit sharpens the estimate, which lets the next pass discard pairs that were
// only borderline members — standard iterative reweighting, and it matters
// because a handful of scattered collisions inside the initial bin would
// otherwise bias the slope.
const REFIT_TOLERANCES = [OFFSET_BIN, OFFSET_BIN / 2, OFFSET_BIN / 4];

// A refit that moves beta more than this is not refining the grid answer, it is
// fitting a different line — reject rather than trust it.
const REFIT_MAX_DRIFT = 0.02;

function refitLine(pairs, beta0, offset0) {
  let beta = beta0;
  let offset = offset0;
  let inliers = 0;
  let rms = 0;

  for (const tol of REFIT_TOLERANCES) {
    const inl = [];
    for (const p of pairs) {
      if (Math.abs(p[0] - beta * p[1] - offset) <= tol) inl.push(p);
    }
    if (inl.length < MIN_LINE_VOTES) break;

    let sx = 0;
    let sy = 0;
    for (const p of inl) {
      sx += p[1];
      sy += p[0];
    }
    const mx = sx / inl.length;
    const my = sy / inl.length;
    let num = 0;
    let den = 0;
    for (const p of inl) {
      const dx = p[1] - mx;
      num += dx * (p[0] - my);
      den += dx * dx;
    }
    // den == 0 means every inlier shares one reference time — no slope
    // information at all, so keep the previous estimate.
    if (den <= 0) break;

    const b = num / den;
    const c = my - b * mx;
    if (!Number.isFinite(b) || Math.abs(b / beta0 - 1) > REFIT_MAX_DRIFT) break;

    let sq = 0;
    for (const p of inl) {
      const r = p[0] - b * p[1] - c;
      sq += r * r;
    }
    beta = b;
    offset = c;
    inliers = inl.length;
    rms = Math.sqrt(sq / inl.length);
  }

  return inliers ? { beta, offset, inliers, rms } : null;
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

  // Refine the slope off the grid. Acceptance still uses the grid's lift — the
  // refit improves the ESTIMATE, it does not add evidence, so letting it move
  // the decision statistic would be double-counting.
  const refit = refitLine(pairs, best.beta, best.offset);

  return {
    votes: best.votes,
    lift: best.lift,
    // Retained for continuity with the first measured run. It is NOT the
    // acceptance statistic — it penalizes warped queries, where most hashes
    // legitimately cannot match, so it conflates "damaged" with "unrelated".
    score: best.votes / Math.max(1, Math.min(queryHashes.length, refHashes.length)),
    beta: refit ? refit.beta : best.beta,
    offset: refit ? refit.offset : best.offset,
    // Kept so a regression in the refit is visible rather than silent: if
    // beta and beta_grid ever agree exactly, the refit stopped running.
    beta_grid: best.beta,
    inliers: refit ? refit.inliers : 0,
    // Residual spread of the fitted line, in seconds. This is the honest
    // confidence interval on beta — a tight line over a long span is a precise
    // slope, a fat one is not, and the seeded search should widen its sweep
    // accordingly instead of assuming a fixed precision.
    residual_rms: refit ? refit.rms : null,
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