// BASE Mark — multi-window evidence combining for the spectral layer.
//
// WHY THIS EXISTS
// A seeded re-timed recovery is inherently marginal. Measured: seeding the
// spectral detector with a Print-derived warp factor decoded the EXACT payload
// from 44.1->48kHz resampled audio, but at a mean strength of 0.033 against that
// window's 0.0377 multi-candidate gate. The recovery was real and the detector
// correctly abstained, because a single window did not carry enough evidence to
// rule out coincidence.
//
// The wrong fixes, and why:
//   - Lower the gate. That is just choosing a higher false-positive rate, and the
//     gate is the only thing standing between us and a confident wrong
//     attribution.
//   - Use a longer decode window. Measured and it is actively WORSE: at 24s the
//     same seeded ratio collapsed to 0.005, because any residual ratio error
//     accumulates sample drift in proportion to length. ~12s is the sweet spot.
//
// The right fix is more evidence at the SAME window length: decode several
// NON-OVERLAPPING windows at the same seeded ratio and combine them. Windows are
// independent, so this adds evidence without adding candidates — critical,
// because it is the candidate count that inflates the false-positive rate, and
// this leaves it untouched.
//
// TWO INDEPENDENT COMBINED STATISTICS
// 1. Payload consensus. Two windows independently decoding the same 32-bit value
//    is a 2^-32 coincidence. This is by far the stronger signal and is the one
//    doing the real work — noise-driven decodes disagree.
// 2. Strength averaging. The mean of W independent per-window strengths has its
//    noise deviation reduced by sqrt(W), so the gate scales down by the same
//    factor. This is the standard result, and it is why averaging is legitimate
//    here while simply relaxing the gate is not.
//
// Registry confirmation is still owed by the caller, exactly as with the
// single-shot search: a consensus payload matching no registered asset is a false
// positive and must be discarded, never reported.

import { encodeWav } from './audioAttacks.ts';
import { detectMark } from './baseMark.ts';
import { SEARCH_GATE_MULTIPLE, SEARCH_MIN_STRENGTH } from './baseMarkSearch.ts';
import { sliceWindow } from './audioBenchUtils.ts';

// Measured optimum. Long enough for the payload gate to be clearable, short
// enough that residual ratio error has not yet smeared the chip alignment.
export const WINDOW_SECONDS = 12;

// Minimum windows that must agree before a consensus is claimed. One window is
// not a consensus, it is the single-shot case this module exists to improve on.
export const MIN_CONSENSUS_WINDOWS = 2;

// Decode a fixed ratio across several non-overlapping windows and combine.
// `audio` is expected to be ALREADY re-timed by the candidate ratio, so this
// function is agnostic to how the seed was obtained.
export function detectAcrossWindows(audio, opts = {}) {
  const windowSeconds = opts.windowSeconds || WINDOW_SECONDS;
  const maxWindows = opts.maxWindows || 4;
  const total = audio.channels[0].length / audio.sampleRate;
  const available = Math.floor(total / windowSeconds);
  const count = Math.min(maxWindows, available);

  if (count < 1) {
    return { windows: [], consensus_payload: null, agreeing_windows: 0, accepted: false, reason: 'too_short' };
  }

  const windows = [];
  for (let i = 0; i < count; i++) {
    const slice = sliceWindow(audio, i * windowSeconds, windowSeconds);
    if (!slice) continue;
    let res;
    try {
      res = detectMark(encodeWav(slice));
    } catch {
      continue;
    }
    windows.push({
      index: i,
      start_seconds: i * windowSeconds,
      // payload_candidate, NOT payload_hex — the whole point is to see what a
      // window decoded even when it individually abstained.
      payload: res.payload_candidate || null,
      mean_strength: res.mean_strength || 0,
      strength_gate: res.strength_gate || SEARCH_MIN_STRENGTH,
      detected_alone: !!res.detected,
    });
  }

  if (!windows.length) {
    return { windows: [], consensus_payload: null, agreeing_windows: 0, accepted: false, reason: 'no_decodes' };
  }

  // Modal payload across windows.
  const tally = new Map();
  for (const w of windows) {
    if (w.payload) tally.set(w.payload, (tally.get(w.payload) || 0) + 1);
  }
  let consensus = null;
  let agree = 0;
  for (const [p, n] of tally) {
    if (n > agree) {
      agree = n;
      consensus = p;
    }
  }

  const agreeing = windows.filter((w) => w.payload === consensus);
  const meanStrength = agreeing.reduce((s, w) => s + w.mean_strength, 0) / Math.max(1, agreeing.length);

  // Per-window gate, scaled down by sqrt(number of agreeing windows). Uses the
  // strictest gate among the agreeing windows so a single weakly-evidenced window
  // cannot soften the bar for the group.
  const perWindowGate = Math.max(
    SEARCH_MIN_STRENGTH,
    SEARCH_GATE_MULTIPLE * Math.max(...agreeing.map((w) => w.strength_gate)),
  );
  const combinedGate = perWindowGate / Math.sqrt(Math.max(1, agreeing.length));

  // BOTH conditions required. Consensus alone could in principle come from a
  // systematic artifact rather than a real mark, and strength alone is what the
  // single-window case already failed on — so neither is trusted by itself.
  const accepted =
    agree >= MIN_CONSENSUS_WINDOWS && meanStrength >= combinedGate;

  return {
    windows,
    consensus_payload: consensus,
    agreeing_windows: agree,
    total_windows: windows.length,
    mean_strength: meanStrength,
    per_window_gate: perWindowGate,
    combined_gate: combinedGate,
    accepted,
  };
}