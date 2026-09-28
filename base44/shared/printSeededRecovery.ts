// TRADE SECRET — BASE Station proprietary and confidential. Server-side only.
// Do not copy, publish, redistribute or import into client code.
// BASE Print -> spectral seeded recovery.
//
// This is the ONLY path by which a Print match may contribute to an attribution,
// and it is deliberately structured so the Print never makes the decision.
//
//   Print proposes    — a candidate reference and a warp factor beta.
//   Spectral decides  — invert that beta, run the real detector, apply the
//                       detector's own calibrated gate.
//   Registry confirms — a recovered payload that matches no registered asset is
//                       a false positive and is discarded (FORENSIC_SPEC §8).
//
// WHY THE SPLIT IS NOT OPTIONAL
// The measured n=6 Print benchmark established that the lift statistic CANNOT
// gate acceptance: the strongest unrelated lift (14.93) overlaps genuine warped
// matches (14.87, 16.20). No lift threshold separates them. What the same run
// established is that the fitted GEOMETRY is a strong discriminator — every
// genuine cell recovered beta to within 0.25%, every spurious fit was wrong by
// 49-79%. So lift is used only to generate candidates, and a wrong beta costs
// one failed recovery attempt instead of producing a false attribution.
//
// WHAT IS STILL UNMEASURED ON SPEECH
// Everything above was measured on MUSIC at 20 seconds. Spoken-word mono is
// spectrally sparser and podcasts are 20-60 minutes long. Until the speech
// calibration run lands, this path is advisory-only regardless of outcome, and
// the caller must not promote it.

import { matchAgainstMany } from './basePrintMatch.ts';
import { encodeWav, pitchShiftResample } from './audioAttacks.ts';
import { detectMark } from './baseMark.ts';
import { SEARCH_GATE_MULTIPLE, SEARCH_MIN_STRENGTH } from './baseMarkSearch.ts';
import { sliceWindow, trimCentered } from './audioBenchUtils.ts';

// How many Print candidates are worth inverting. Each one is a full resample
// plus a correlation pass, so this is a hard CPU bound, not a tuning knob. The
// candidates are lift-ranked, and the measured bimodality of beta accuracy
// means a genuine source — when present — is overwhelmingly near the top.
export const MAX_SEEDED_CANDIDATES = 3;

// Micro-search around Print's proposed ratio. MEASURED, not guessed: V1's chip
// sequence decorrelates within about one sample of drift, while Print's beta
// error runs 17-540 ppm, so a single seeded candidate misses. The +/-60 ppm
// range at 10 ppm steps is the range that covered every observed error with
// headroom, and the step holds because the recovery peak has ~5x contrast
// against its neighbours and so cannot be stepped over.
const LADDER_PPM = [0, -10, 10, -20, 20, -30, 30, -40, 40, -50, 50, -60, 60];

// Probe several positions and keep the strongest. Watermark evidence is
// content-dependent and unevenly distributed: a centred single probe reported a
// clean miss on a master whose middle section was a sparse breakdown, while the
// same seed recovered the payload from other windows. For SPEECH this matters
// more, not less — a long dialogue has genuine silence in it, and a probe that
// lands in a pause evidences nothing. Max-over-positions is the right
// reduction; an average would let one dead section veto the sections that carry
// the mark.
const PROBE_FRACTIONS = [0.05, 0.35, 0.65, 0.9];
const PROBE_SECONDS = 8;
const CONFIRM_SECONDS = 12;

const semitonesOf = (ratio) => 12 * Math.log2(ratio);

// Locate the alignment cheaply with single-window probes, then spend the real
// detection ONCE on the winner. Strength here steers only — it decides nothing,
// which is why no gate is applied at this stage.
function findBestOffsetPpm(suspect, ratioEst) {
  let best = null;
  for (const ppm of LADDER_PPM) {
    const undone = pitchShiftResample(suspect, -semitonesOf(ratioEst * (1 + ppm / 1e6)));
    const dur = undone.channels[0].length / undone.sampleRate;
    for (const frac of PROBE_FRACTIONS) {
      const start = Math.min(Math.max(0, dur * frac), Math.max(0, dur - PROBE_SECONDS));
      const slice = sliceWindow(undone, start, PROBE_SECONDS);
      if (!slice) continue;
      try {
        const r = detectMark(encodeWav(slice));
        const strength = r.mean_strength || 0;
        if (!best || strength > best.strength) best = { ppm, strength, at: start };
      } catch { /* an unusable probe window is not a result */ }
    }
  }
  return best;
}

/**
 * Attempt a Print-seeded spectral recovery.
 *
 * Returns { recovered, payload_hex, matched, beta, ... }. `recovered: true`
 * means the spectral detector cleared its own stricter multi-candidate gate at
 * a Print-proposed alignment. Registry confirmation is the CALLER's remaining
 * obligation — this module has no business deciding what is registered.
 */
export function attemptSeededRecovery(queryHashes, queryAudio, references) {
  const ranked = matchAgainstMany(queryHashes, references);
  const candidates = ranked
    .filter((c) => c.beta > 0 && c.inliers > 0 && !c.beta_at_boundary)
    .slice(0, MAX_SEEDED_CANDIDATES);

  if (!candidates.length) {
    return { recovered: false, reason: 'no_print_candidates', candidates_considered: ranked.length };
  }

  for (const cand of candidates) {
    // beta maps reference time -> query time, so the correction that undoes it
    // is its reciprocal.
    const ratioEst = 1 / cand.beta;
    const probe = findBestOffsetPpm(queryAudio, ratioEst);
    if (!probe) continue;

    const corrected = ratioEst * (1 + probe.ppm / 1e6);
    const undone = trimCentered(pitchShiftResample(queryAudio, -semitonesOf(corrected)), CONFIRM_SECONDS);
    let res;
    try {
      res = detectMark(encodeWav(undone));
    } catch {
      continue;
    }

    const strength = res.mean_strength || 0;
    // The stricter bar, for the reason it exists: trying N candidates and
    // keeping the best gives the detector N chances to hallucinate a mark, so
    // matching the single-shot gate would inflate the false-positive rate by
    // roughly N.
    const searchGate = Math.max(
      SEARCH_MIN_STRENGTH,
      SEARCH_GATE_MULTIPLE * (res.strength_gate || SEARCH_MIN_STRENGTH),
    );

    if (res.detected && res.payload_hex && strength >= searchGate) {
      return {
        recovered: true,
        payload_hex: res.payload_hex,
        matched_asset_id: cand.id,
        matched_row: cand.row,
        beta: cand.beta,
        ratio_applied: corrected,
        offset_ppm: probe.ppm,
        lift: cand.lift,
        inliers: cand.inliers,
        residual_rms: cand.residual_rms,
        mean_strength: strength,
        search_gate: searchGate,
        candidates_considered: candidates.length,
      };
    }
  }

  return {
    recovered: false,
    reason: 'seeded_recovery_failed',
    candidates_considered: candidates.length,
    // Kept so a near-miss is visible rather than indistinguishable from "no
    // candidate at all" — those are different diagnoses.
    best_candidate: {
      matched_asset_id: candidates[0].id,
      lift: candidates[0].lift,
      beta: candidates[0].beta,
    },
  };
}