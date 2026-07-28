// BASE Mark — desynchronization search detector (spectral layer).
//
// WHY THIS EXISTS
// Resampling (pitch shift) and time-stretching defeat every embedded audio
// watermark we are aware of. The 2025 independent survey "SoK: How Robust is
// Audio Watermarking in Generative AI models?" (arXiv:2503.19176) benchmarked
// nine schemes — WavMark, AudioSeal, Timbre, RobustDNN, audiowmark, Norm-space,
// Patchwork, FSVC and SilentCipher — and every single one failed pitch shift.
// Our own benchmark measured the same on both BASE Mark layers.
//
// The reason is desynchronization, not erasure: resampling rescales the time
// axis, so a chip sequence keyed to a fixed sample length no longer lines up.
// The mark is still in the file — the detector just can't find it.
//
// So instead of adding a fourth embedder that also fails, this inverts the
// problem: search the attack space at DETECTION time. We re-time the suspect
// audio by a grid of candidate inverse factors and run the standard detector at
// each one. If the file was pitched up a semitone, the candidate that pitches it
// back down restores alignment and the payload decodes normally.
//
// This is only possible because the spectral layer is ours, runs locally, and
// costs no GPU — a full grid is dozens of cheap correlations, not dozens of
// model invocations.
//
// FALSE-POSITIVE DISCIPLINE
// Trying N candidates and keeping the best gives the detector N chances to
// hallucinate a mark, so a plain single-shot threshold is no longer valid. Two
// safeguards: (1) a candidate must clear a STRICTER strength gate than the
// single-shot detector uses, and (2) callers must confirm the recovered payload
// against the asset registry. A payload matching no registered asset is a
// false positive and must be discarded, never reported as a hit.

import { detectMark } from './baseMark.ts';
import { decodeWav, encodeWav, pitchShiftResample, timeStretchOLA } from './audioAttacks.ts';

// Extra evidence a searched hit must carry, as a multiple of the detector's own
// evidence-scaled strength gate. Trying N candidates and keeping the best gives
// the detector N independent chances to hallucinate a mark, so matching the
// single-shot gate would inflate the false-positive rate by roughly N. Requiring
// 1.5x the gate the detector computed for that clip keeps the search honest
// while staying duration-aware.
export const SEARCH_GATE_MULTIPLE = 1.5;

// Absolute floor retained for callers that want a single constant; the real
// acceptance test is SEARCH_GATE_MULTIPLE against the per-clip gate.
export const SEARCH_MIN_STRENGTH = 0.03;

// Candidate inverse transforms. Each entry undoes a plausible attack.
// `cents` walks the resampling axis (pitch shift + inverse duration change),
// `stretch` walks the duration-only axis (pitch-preserved tempo change).
export function buildCandidates({ centsRange = 300, centsStep = 25, stretchRange = 0.08, stretchStep = 0.01 } = {}) {
  const out = [{ key: 'identity', label: 'No re-timing', apply: (a) => a }];

  for (let c = centsStep; c <= centsRange; c += centsStep) {
    for (const sign of [1, -1]) {
      const cents = sign * c;
      out.push({
        key: `cents_${cents > 0 ? '+' : ''}${cents}`,
        label: `Re-pitch ${cents > 0 ? '+' : ''}${cents} cents`,
        apply: (a) => pitchShiftResample(a, cents / 100),
      });
    }
  }

  for (let s = stretchStep; s <= stretchRange + 1e-9; s += stretchStep) {
    for (const sign of [1, -1]) {
      const f = 1 + sign * s;
      out.push({
        key: `stretch_${f.toFixed(2)}`,
        label: `Re-time x${f.toFixed(2)}`,
        apply: (a) => timeStretchOLA(a, f),
      });
    }
  }

  return out;
}

// Evaluate a specific list of candidates and return the best accepted hit.
// Shared by the benchmark grid sweep and the curated deep scan so both apply
// exactly the same acceptance rule.
export function evaluateCandidates(bytes, candidates) {
  const audio = decodeWav(bytes);

  // Selection must rank ACCEPTED candidates above merely strong ones. Ranking by
  // raw strength alone and only then checking acceptance loses genuine hits: a
  // re-timing that mangles the audio can post a higher unnormalized strength than
  // the correct one while failing its own gates, and it would then suppress the
  // real recovery. Measured — the curated list missed a true +1 semitone hit that
  // a 3-candidate grid found, purely because of this ordering.
  let best = null;      // best accepted candidate
  let bestAny = null;   // strongest candidate overall, for diagnostics only

  for (const cand of candidates) {
    let res;
    try {
      res = cand.key === 'identity' ? detectMark(bytes) : detectMark(encodeWav(cand.apply(audio)));
    } catch {
      continue;
    }
    const strength = res.mean_strength || 0;
    if (!bestAny || strength > bestAny.strength) bestAny = { strength, res, cand };

    // A candidate must pass the detector's own gates AND clear the stricter
    // multi-candidate bar for the evidence this clip actually had.
    const searchGate = Math.max(
      SEARCH_MIN_STRENGTH,
      SEARCH_GATE_MULTIPLE * (res.strength_gate || SEARCH_MIN_STRENGTH),
    );
    if (res.detected && strength >= searchGate) {
      if (!best || strength > best.strength) best = { strength, res, cand };
    }
  }

  if (best) {
    return {
      detected: true,
      payload_hex: best.res.payload_hex,
      mean_strength: Number(best.strength.toFixed(4)),
      candidate: best.cand.key,
      candidate_label: best.cand.label,
      candidates_tried: candidates.length,
    };
  }

  return {
    detected: false,
    payload_hex: null,
    mean_strength: bestAny ? Number(bestAny.strength.toFixed(4)) : 0,
    candidate: null,
    candidate_label: null,
    candidates_tried: candidates.length,
  };
}

// Run the spectral detector across the full candidate grid and return the best
// hit. `detected` already applies the stricter search gate; the caller still
// owes the registry confirmation described above.
export function detectMarkDesync(bytes, options = {}) {
  return evaluateCandidates(bytes, options.candidates || buildCandidates(options));
}

// ── Curated deep scan ──────────────────────────────────────────────────────
//
// A blind grid is the wrong tool for a live request: an arbitrary sweep is
// hundreds of correlations and blows the CPU budget, and most of the grid tests
// ratios no real pipeline ever produces. This list is curated from the ways
// audio ACTUALLY gets re-timed in the wild, so a short bounded run covers the
// realistic attack surface:
//
//  - Sample-rate mishandling (44.1kHz <-> 48kHz). Not an attack at all — it
//    happens by accident constantly in real production chains, and it is an
//    exactly known ratio, so it is the single highest-value candidate here.
//  - Whole musical semitones, the intuitive "just pitch it" edit.
//  - Small percentage speed nudges (1-3%), the standard trick for dodging
//    content fingerprinting while staying imperceptible to listeners.
//
// Every candidate must be EXACT. Measured tolerance is brutally tight — a
// candidate even 2 cents off recovers nothing, and a 0.04-cent discrepancy was
// enough to lose a genuine hit — because a pseudo-noise chip sequence
// decorrelates within about one sample of drift. That is why these are declared
// as ratios and the cents derived, and why a stepped grid is useless here: it
// only ever recovers a shift that happens to land exactly on a grid point.
//
// Anything outside this list — an arbitrary hand-dialed speed nudge, or any
// pitch-preserved tempo change — is genuinely out of reach, and no
// detection-time search is a defence against it.
// Candidates are declared as the EXACT ratio the attack applies, and the cents
// are derived from it. Hand-computed cent values are a trap here: benchmarking
// showed a candidate only a few cents off the true ratio fails to recover the
// mark at all, so a rounded constant silently produces a dead candidate that
// still costs full CPU. Declaring intent as a ratio makes the candidate exact by
// construction.
const centsOf = (ratio) => 1200 * Math.log2(ratio);

const RATIO_CANDIDATES = [
  { ratio: 48000 / 44100, why: '44.1kHz master played at 48kHz' },
  { ratio: 44100 / 48000, why: '48kHz master played at 44.1kHz' },
  { ratio: Math.pow(2, 1 / 12), why: 'Pitched up 1 semitone' },
  { ratio: Math.pow(2, -1 / 12), why: 'Pitched down 1 semitone' },
  { ratio: Math.pow(2, 2 / 12), why: 'Pitched up 2 semitones' },
  { ratio: Math.pow(2, -2 / 12), why: 'Pitched down 2 semitones' },
  { ratio: 1.01, why: 'Sped up 1%' },
  { ratio: 1 / 1.01, why: 'Slowed down 1%' },
  { ratio: 1.02, why: 'Sped up 2%' },
  { ratio: 1 / 1.02, why: 'Slowed down 2%' },
  { ratio: 1.03, why: 'Sped up 3%' },
  { ratio: 1 / 1.03, why: 'Slowed down 3%' },
];

const CENTS_CANDIDATES = RATIO_CANDIDATES.map(({ ratio, why }) => ({
  cents: centsOf(ratio),
  why,
}));

// NO pitch-preserved tempo candidates. Measured: even the exact inverse stretch
// fails to recover the mark, because overlap-add resynthesis is not invertible —
// it discards the fine phase structure the chip sequence lives in, so a second
// OLA pass adds smearing instead of restoring sample alignment. Including them
// would have consumed a third of the CPU budget for a permanent 0% hit rate, so
// tempo-stretched audio is honestly out of reach for this method.
export const CURATED_CANDIDATES = [
  { key: 'identity', label: 'No re-timing', apply: (a) => a },
  ...CENTS_CANDIDATES.map(({ cents, why }) => ({
    key: `cents_${cents > 0 ? '+' : ''}${cents.toFixed(2)}`,
    label: why,
    apply: (a) => pitchShiftResample(a, -cents / 100),
  })),
];

// Candidates are processed in bounded batches across separate invocations. A
// single correlation pass over a 12-second clip is a few seconds of CPU, so
// running all 19 in one request would exceed the function time limit — the
// exact failure that killed the earlier blind-sweep attempt.
export const DEEP_SCAN_BATCH = 3;
export const DEEP_SCAN_TOTAL = CURATED_CANDIDATES.length;

// Fixed evidence window: both a cap AND a floor.
//
// As a cap it keeps each batch inside a predictable CPU budget no matter how long
// a file the user drops. As a floor it is a hard requirement — a re-timed
// recovery is inherently marginal, and the payload gate tightens as the block
// count falls, so the same +1 semitone shift that recovers at 100% from a
// 12-second window is rejected outright from an 8-second one. Measured, not
// assumed. Below this length the deep scan declines instead of reporting a miss
// it can't stand behind.
export const DEEP_SCAN_SECONDS = 12;
export const DEEP_SCAN_MIN_SECONDS = 12;

export function deepScanSeconds(bytes) {
  const audio = decodeWav(bytes);
  return audio.channels[0].length / audio.sampleRate;
}

export function trimForDeepScan(bytes) {
  const audio = decodeWav(bytes);
  const want = Math.floor(DEEP_SCAN_SECONDS * audio.sampleRate);
  if (audio.channels[0].length <= want) return bytes;
  const start = Math.floor((audio.channels[0].length - want) / 2);
  return encodeWav({
    sampleRate: audio.sampleRate,
    channels: audio.channels.map((x) => x.slice(start, start + want)),
  });
}