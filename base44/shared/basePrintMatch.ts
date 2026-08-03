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
// consistent slope or offset. We recover (beta, offset) by voting and use the
// vote count as the score. The fitted slope beta IS the tempo-stretch factor —
// the number handed back to the spectral detector so it can invert the warp once
// and attempt a real payload recovery.
//
// ── ABSTENTION APPLIES HERE TOO ────────────────────────────────────────────
// Same discipline as the Mark Layers (BASE_MARK_FORENSIC_SPEC.md §8): a wrong
// attribution is worse than no attribution. Scores below the acceptance floor
// return no match rather than a best guess, and the floor must be calibrated
// from a measured null distribution against unrelated audio — NOT guessed here.
// The defaults below are placeholders to make the benchmark runnable and are
// explicitly NOT validated thresholds.

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

// PLACEHOLDERS. Must be replaced with values derived from the measured null
// distribution before any match is surfaced to a user or quoted in a report.
export const PROVISIONAL_MIN_VOTES = 12;
export const PROVISIONAL_MIN_SCORE = 0.02;

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
function vote(pairs, betas) {
  let bestBeta = 1;
  let bestOffset = 0;
  let bestVotes = 0;
  const hist = new Map();
  for (const beta of betas) {
    hist.clear();
    for (const pair of pairs) {
      const bin = Math.round((pair[0] - beta * pair[1]) / OFFSET_BIN);
      const n = (hist.get(bin) || 0) + 1;
      hist.set(bin, n);
      if (n > bestVotes) {
        bestVotes = n;
        bestBeta = beta;
        bestOffset = bin * OFFSET_BIN;
      }
    }
  }
  return { beta: bestBeta, offset: bestOffset, votes: bestVotes };
}

function logSpace(min, max, steps) {
  const out = [];
  const lo = Math.log2(min);
  const hi = Math.log2(max);
  for (let i = 0; i <= steps; i++) out.push(Math.pow(2, lo + ((hi - lo) * i) / steps));
  return out;
}

export function matchPrints(queryHashes, refHashes, opts = {}) {
  const minVotes = opts.minVotes === undefined ? PROVISIONAL_MIN_VOTES : opts.minVotes;
  const minScore = opts.minScore === undefined ? PROVISIONAL_MIN_SCORE : opts.minScore;
  const empty = { votes: 0, score: 0, beta: 1, offset: 0, pairs: 0, accepted: false };
  if (!queryHashes.length || !refHashes.length) return empty;

  const idx = buildIndex(refHashes);
  const pairs = [];
  for (const q of queryHashes) {
    const times = idx.get(q.hash);
    if (!times) continue;
    for (const tr of times) pairs.push([q.t, tr]);
  }
  if (pairs.length < minVotes) return { ...empty, pairs: pairs.length };

  // Coarse pass over the full range, then refine +/- one coarse step around it.
  const coarse = vote(pairs, logSpace(BETA_MIN, BETA_MAX, 40));
  const span = Math.pow(2, 1 / 40);
  const fine = vote(
    pairs,
    logSpace(Math.max(BETA_MIN, coarse.beta / span), Math.min(BETA_MAX, coarse.beta * span), 20),
  );
  const best = fine.votes >= coarse.votes ? fine : coarse;

  const score = best.votes / Math.max(1, Math.min(queryHashes.length, refHashes.length));
  return {
    votes: best.votes,
    score,
    beta: best.beta,
    offset: best.offset,
    pairs: pairs.length,
    accepted: best.votes >= minVotes && score >= minScore,
  };
}

// Rank a query against many references. Returns EVERY candidate sorted by score
// so a benchmark can inspect the full distribution — the margin between the top
// genuine match and the best unrelated one IS the specificity measurement, and
// it disappears if only the winner is returned.
export function matchAgainstMany(queryHashes, refs, opts = {}) {
  return refs
    .map((r) => Object.assign({ id: r.id }, matchPrints(queryHashes, r.hashes, opts)))
    .sort((a, b) => b.score - a.score);
}