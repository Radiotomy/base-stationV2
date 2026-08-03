// BASE Mark — does the Print -> Spectral seeded-search loop actually close?
// Admin only. This is a measurement harness, not a production path.
//
// THE QUESTION
// The Print Layer recovers a warp factor (beta) from re-timed audio, including in
// cases where every watermark layer measures 0%. The obvious move is to hand beta
// to the spectral detector, invert the warp, and decode the payload. But V1's
// chip sequence decorrelates within roughly ONE SAMPLE of drift, and the deep
// scan already measured a 0.04-cent discrepancy losing a genuine hit. Measured
// Print beta errors are 0.017%-0.25%, which over a single 33,792-sample block is
// 6 to 84 samples of drift. So the loop may simply not close.
//
// WHY THIS MEASURES TOLERANCE INSTEAD OF RUNNING THE SEARCH
// A blind micro-search over the beta uncertainty band would be ~250 candidates at
// several seconds of CPU each — far past the function limit, and it would answer
// only "did it work this time." The useful quantity is the SHAPE of the problem:
//
//   1. How wide is V1's recovery window, in parts per million of ratio error?
//   2. How far off is Print's beta, in the same units?
//
// Those two numbers decide everything. If the window is wider than beta's error,
// one candidate suffices and the loop closes trivially. If not, their ratio gives
// the exact candidate count a seeded search needs — and if that count is absurd,
// the architecture is wrong and we stop, the same call already made on FSVC and
// on tempo-stretch inversion.
//
// Offsets are expressed in ppm of the ratio (1000 ppm = 0.1%) because that is the
// natural unit of the failure: 1 ppm of a 44,100 Hz ratio is ~0.04 samples per
// second of drift.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { decodeWav, encodeWav, pitchShiftResample } from '../../shared/audioAttacks.ts';
import { embedMark, detectMark, payloadFromId } from '../../shared/baseMark.ts';
import { computePrint } from '../../shared/basePrint.ts';
import { matchPrints } from '../../shared/basePrintMatch.ts';
import { SEARCH_GATE_MULTIPLE, SEARCH_MIN_STRENGTH } from '../../shared/baseMarkSearch.ts';
import { toMono, trimCentered, round } from '../../shared/audioBenchUtils.ts';

// Attacks worth testing here are exactly the resample family — the class V1/V2/V3
// all measure 0% on and V4 (the GPLv3 layer) currently owns. Tempo stretch is
// deliberately absent: OLA resynthesis is not invertible, so no beta precision
// recovers it and including it would measure a known 0%.
const ATTACK_RATIOS = {
  resample_48_441: { ratio: 48000 / 44100, label: '44.1kHz master played at 48kHz' },
  resample_441_48: { ratio: 44100 / 48000, label: '48kHz master played at 44.1kHz' },
  pitch_up_1: { ratio: Math.pow(2, 1 / 12), label: 'Pitched up 1 semitone' },
  pitch_up_2: { ratio: Math.pow(2, 2 / 12), label: 'Pitched up 2 semitones' },
};

// Default probe ladder, logarithmically spaced so one run brackets the window
// whether it turns out to be ~10 ppm or ~1000 ppm wide.
const DEFAULT_OFFSETS = [0, 20, -20, 100, -100, 500, -500];

const semitonesOf = (ratio) => 12 * Math.log2(ratio);

// Build the marked master and the re-timed suspect. Shared by both actions so
// they describe the same file — comparing a beta measured on one pipeline against
// a tolerance measured on another would be meaningless.
async function setup(url, seconds, attackKey) {
  const attack = ATTACK_RATIOS[attackKey];
  if (!attack) throw new Error(`Unknown attack: ${attackKey}`);

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not fetch source (${r.status})`);
  const audio = trimCentered(decodeWav(new Uint8Array(await r.arrayBuffer())), seconds);

  // Mark the master, exactly as production would, THEN attack it. Printing an
  // unmarked master and attacking a marked one would silently measure a different
  // system than the one we ship.
  const payload = payloadFromId('seeded-scan-experiment');
  const marked = embedMark(encodeWav(audio), payload);
  const markedAudio = decodeWav(marked);
  const suspect = pitchShiftResample(markedAudio, semitonesOf(attack.ratio));

  return { attack, payload, markedAudio, suspect };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'tolerance';
    const seconds = Number(body.seconds) || 12;
    const attackKey = body.attack || 'resample_48_441';
    if (!body.url) return Response.json({ error: 'url is required' }, { status: 400 });

    const { attack, payload, markedAudio, suspect } = await setup(body.url, seconds, attackKey);

    // ── beta: what does the Print Layer actually hand us? ───────────────────
    if (action === 'beta') {
      const ref = computePrint(toMono(markedAudio), markedAudio.sampleRate);
      const q = computePrint(toMono(suspect), suspect.sampleRate, true);
      const m = matchPrints(q, ref);

      // A resample by `ratio` divides duration by it, so the genuine slope is
      // 1/ratio. Reporting error in ppm of the RATIO keeps it directly comparable
      // to the tolerance ladder.
      const betaTrue = 1 / attack.ratio;
      const ratioEst = m.beta > 0 ? 1 / m.beta : 0;
      const ppmError = ratioEst ? ((ratioEst - attack.ratio) / attack.ratio) * 1e6 : null;

      return Response.json({
        action,
        attack: attackKey,
        attack_label: attack.label,
        seconds,
        beta: round(m.beta, 6),
        beta_true: round(betaTrue, 6),
        ratio_estimated: round(ratioEst, 6),
        ratio_true: round(attack.ratio, 6),
        ratio_error_ppm: ppmError === null ? null : round(ppmError, 1),
        lift: round(m.lift, 2),
        votes: m.votes,
        note:
          'ratio_error_ppm is the number to compare against the tolerance run. If it falls inside the ' +
          'measured recovery window, a single seeded candidate closes the loop.',
      });
    }

    // ── tolerance: how wide is V1's recovery window? ────────────────────────
    if (action === 'tolerance') {
      const offsets = Array.isArray(body.offsets_ppm) && body.offsets_ppm.length
        ? body.offsets_ppm
        : DEFAULT_OFFSETS;

      const rows = [];
      for (const ppm of offsets) {
        // Undo the attack using a DELIBERATELY IMPERFECT ratio, off by `ppm`.
        // This is the seeded candidate a real search would test.
        const guess = attack.ratio * (1 + ppm / 1e6);
        const undone = pitchShiftResample(suspect, -semitonesOf(guess));
        let res;
        try {
          res = detectMark(encodeWav(undone));
        } catch (e) {
          rows.push({ offset_ppm: ppm, error: e.message });
          continue;
        }
        const strength = res.mean_strength || 0;
        const searchGate = Math.max(
          SEARCH_MIN_STRENGTH,
          SEARCH_GATE_MULTIPLE * (res.strength_gate || SEARCH_MIN_STRENGTH),
        );
        rows.push({
          offset_ppm: ppm,
          detected: !!res.detected,
          // The only outcome that matters. A detection carrying the wrong payload
          // is a false positive, not a partial success.
          payload_exact: res.payload_hex === payload,
          mean_strength: round(strength),
          strength_gate: round(res.strength_gate || 0),
          search_gate: round(searchGate),
          passes_search_gate: strength >= searchGate,
          blocks_scanned: res.blocks_scanned,
        });
      }

      const good = rows.filter((r) => r.payload_exact && r.passes_search_gate).map((r) => r.offset_ppm);
      return Response.json({
        action,
        attack: attackKey,
        attack_label: attack.label,
        seconds,
        expected_payload: payload,
        rows,
        summary: {
          recovered_offsets_ppm: good,
          window_min_ppm: good.length ? Math.min(...good) : null,
          window_max_ppm: good.length ? Math.max(...good) : null,
        },
        note:
          'passes_search_gate applies the stricter multi-candidate bar, because a seeded search tries many ' +
          'candidates and keeping the best otherwise multiplies the false-positive rate. The recovered ' +
          'window width divided by the Print beta error is the candidate count a real seeded search needs.',
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}