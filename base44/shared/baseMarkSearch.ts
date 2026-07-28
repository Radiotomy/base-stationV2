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

// Strength floor for accepting a searched hit. detectMark's own single-shot gate
// is 0.02; a grid search needs more evidence per candidate to hold the same
// overall false-positive rate.
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

// Run the spectral detector across the candidate grid and return the best hit.
// Returns { detected, payload_hex, mean_strength, candidate, candidates_tried }.
// `detected` already applies the stricter search gate; the caller still owes the
// registry confirmation described above.
export function detectMarkDesync(bytes, options = {}) {
  const candidates = options.candidates || buildCandidates(options);
  const audio = decodeWav(bytes);

  let best = null;
  for (const cand of candidates) {
    let res;
    try {
      res = cand.key === 'identity' ? detectMark(bytes) : detectMark(encodeWav(cand.apply(audio)));
    } catch {
      continue;
    }
    const strength = res.mean_strength || 0;
    if (!best || strength > best.strength) {
      best = { strength, res, cand };
    }
  }

  if (!best) {
    return { detected: false, payload_hex: null, mean_strength: 0, candidate: null, candidates_tried: candidates.length };
  }

  const accepted = best.res.detected && best.strength >= SEARCH_MIN_STRENGTH;
  return {
    detected: accepted,
    payload_hex: accepted ? best.res.payload_hex : null,
    mean_strength: Number(best.strength.toFixed(4)),
    candidate: best.cand.key,
    candidate_label: best.cand.label,
    candidates_tried: candidates.length,
  };
}