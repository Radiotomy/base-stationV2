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
import { toMono, trimCentered, round, sliceWindow } from '../../shared/audioBenchUtils.ts';

// Bit distance between two 32-bit hex payloads. The ladder needs this because a
// probe at the CORRECT alignment can still return a payload one bit off — that
// is exactly the AnalogHouse failure mode the consensus clustering was built
// for — and scoring such a probe as "not genuine" would send the ladder hunting
// for a peak it had already found.
function bitsOff(a, b) {
  if (!a || !b) return 32;
  let x = ((parseInt(a, 16) >>> 0) ^ (parseInt(b, 16) >>> 0)) >>> 0;
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
}
import { detectAcrossWindows, MAX_CLUSTER_HAMMING } from '../../shared/baseMarkMultiWindow.ts';

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
// nullMode skips the embed entirely. Everything downstream is IDENTICAL, which is
// the point: a false-positive rate is only meaningful if the null path is the
// exact same code as the real one. Any accepted consensus in null mode is a false
// positive and invalidates the acceptance rule.
async function loadSource(url, seconds) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not fetch source (${r.status})`);
  return trimCentered(decodeWav(new Uint8Array(await r.arrayBuffer())), seconds);
}

// Mark the master, exactly as production would, THEN attack it. Printing an
// unmarked master and attacking a marked one would silently measure a different
// system than the one we ship.
function buildMaster(audio, nullMode) {
  const payload = payloadFromId('seeded-scan-experiment');
  const marked = nullMode ? encodeWav(audio) : embedMark(encodeWav(audio), payload);
  return { payload, markedAudio: decodeWav(marked) };
}

async function setup(url, seconds, attackKey, nullMode = false) {
  const attack = ATTACK_RATIOS[attackKey];
  if (!attack) throw new Error(`Unknown attack: ${attackKey}`);

  const audio = await loadSource(url, seconds);
  const { payload, markedAudio } = buildMaster(audio, nullMode);
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

    const nullMode = body.null_mode === true;

    // ── sweep: every attack for one source, in one call ─────────────────────
    // Widening the corpus is the whole point of this run, and doing it as one
    // request per attack means re-fetching and re-marking the same master four
    // times. This loads and marks ONCE, then walks the attack table. Strictly
    // serial: concurrent window decoding has crashed the worker on memory
    // pressure before, and this holds several minutes of audio at once.
    if (action === 'sweep') {
      if (!body.url) return Response.json({ error: 'url is required' }, { status: 400 });
      const audio = await loadSource(body.url, seconds);
      const { payload, markedAudio } = buildMaster(audio, nullMode);
      const ref = computePrint(toMono(markedAudio), markedAudio.sampleRate);
      const offsets = Array.isArray(body.offsets_ppm) && body.offsets_ppm.length ? body.offsets_ppm : [0];
      const maxWindows = Number(body.max_windows) || 4;

      const rows = [];
      // Attack subsetting is not a convenience — a full four-attack sweep with
      // three offsets exceeded the CPU limit (measured). Splitting the attack
      // table across calls is how this stays inside the budget.
      const keys = Array.isArray(body.attacks) && body.attacks.length ? body.attacks : Object.keys(ATTACK_RATIOS);
      for (const key of keys) {
        const atk = ATTACK_RATIOS[key];
        if (!atk) {
          rows.push({ attack: key, error: 'unknown attack' });
          continue;
        }
        const suspect = pitchShiftResample(markedAudio, semitonesOf(atk.ratio));
        const q = computePrint(toMono(suspect), suspect.sampleRate, true);
        const m = matchPrints(q, ref);
        if (!(m.beta > 0)) {
          rows.push({ attack: key, label: atk.label, print_failed: true });
          continue;
        }
        const ratioEst = 1 / m.beta;

        let best = null;
        for (const ppm of offsets) {
          const undone = pitchShiftResample(suspect, -semitonesOf(ratioEst * (1 + ppm / 1e6)));
          const r = detectAcrossWindows(undone, { maxWindows });
          const exact = r.consensus_payload === payload;
          const cand = {
            offset_ppm: ppm,
            agreeing_windows: r.agreeing_windows,
            total_windows: r.total_windows,
            mean_strength: round(r.mean_strength || 0),
            combined_gate: round(r.combined_gate || 0),
            consensus_exact: exact,
            accepted: !!r.accepted,
          };
          // Keep the strongest ACCEPTED row; fall back to the strongest overall so
          // a miss still reports how close it came.
          const better =
            !best ||
            (cand.accepted && !best.accepted) ||
            (cand.accepted === best.accepted && cand.mean_strength > best.mean_strength);
          if (better) best = cand;
        }

        rows.push({
          attack: key,
          label: atk.label,
          ratio_error_ppm: round(((ratioEst - atk.ratio) / atk.ratio) * 1e6, 1),
          print_inliers: m.inliers,
          ...best,
          // In null mode an accepted row is a FALSE POSITIVE, not a success.
          outcome: nullMode
            ? best.accepted
              ? 'FALSE_POSITIVE'
              : 'correctly_abstained'
            : best.accepted && best.consensus_exact
              ? 'recovered'
              : 'missed',
        });
      }

      return Response.json({
        action,
        source: body.url,
        seconds,
        null_mode: nullMode,
        offsets_ppm: offsets,
        rows,
        summary: nullMode
          ? { false_positives: rows.filter((r) => r.outcome === 'FALSE_POSITIVE').length, attacks: rows.length }
          : { recovered: rows.filter((r) => r.outcome === 'recovered').length, attacks: rows.length },
      });
    }

    // ── ladder: find the correct alignment cheaply, before spending on windows ─
    // The sweep exposed the real problem: Print's warp estimate can be 37 ppm off
    // while V1's recovery window is only a few ppm wide, so a single seeded
    // candidate misses. The fix is a micro-search around the estimate — but a
    // 4-window decode per candidate blows the CPU budget immediately.
    //
    // The trick is that ALIGNMENT and CERTIFICATION need different amounts of
    // evidence. Correlation strength peaks sharply at the correct ratio (measured:
    // ~0.033 aligned vs ~0.007 misaligned, a 5x ratio) and that peak is visible in
    // ONE short window, far below the gate. So: use cheap single-window probes to
    // locate the peak, then spend the expensive multi-window combine ONCE, on the
    // winner. Strength here is a steering signal only — it decides nothing.
    if (action === 'ladder') {
      if (!body.url) return Response.json({ error: 'url is required' }, { status: 400 });
      const atk = ATTACK_RATIOS[attackKey];
      if (!atk) return Response.json({ error: `Unknown attack: ${attackKey}` }, { status: 400 });

      const audio = await loadSource(body.url, seconds);
      const { payload, markedAudio } = buildMaster(audio, nullMode);
      const suspect = pitchShiftResample(markedAudio, semitonesOf(atk.ratio));
      const ref = computePrint(toMono(markedAudio), markedAudio.sampleRate);
      const m = matchPrints(computePrint(toMono(suspect), suspect.sampleRate, true), ref);
      if (!(m.beta > 0)) return Response.json({ error: 'Print returned no usable beta' }, { status: 422 });
      const ratioEst = 1 / m.beta;

      const probeSeconds = Number(body.probe_seconds) || 8;
      // MEASURED range, not a guess. The first four-track run used +/-40 and lost
      // two genuine recoveries: Print's warp estimate was 41 ppm off on one master
      // and 54 ppm off on another, so the correct correction sat outside the
      // ladder entirely and the scan reported a clean miss on audio that was
      // recoverable. +/-60 covers every error observed so far with headroom. The
      // step stays at 10 because the recovery peak has measured ~5x contrast
      // against its neighbours, so a 10 ppm grid cannot step over it.
      const offsets = Array.isArray(body.offsets_ppm) && body.offsets_ppm.length
        ? body.offsets_ppm
        : [0, -10, -20, -30, -40, -50, -60, 10, 20, 30, 40, 50, 60];

      // MEASURED: a single centred probe is not safe. On a house master whose
      // middle section is a sparse filtered breakdown, every probe returned flat
      // ~0.011 noise and the ladder reported a clean miss — yet the multi-window
      // confirm at the same seed recovered the payload from the 0s and 36s
      // windows. The mark was there; the probe was looking at the one part of the
      // track that could not evidence it.
      //
      // So probe several positions per offset and keep the STRONGEST. Watermark
      // evidence is content-dependent and unevenly distributed across a master,
      // so max-over-positions is the right reduction — an average would let one
      // dead section veto the sections that do carry the mark. This multiplies
      // probe cost by the number of positions, which is affordable precisely
      // because probes are single-window and deliberately cheap.
      const probeAt = [0.02, 0.35, 0.68];

      const rows = [];
      for (const ppm of offsets) {
        const undone = pitchShiftResample(suspect, -semitonesOf(ratioEst * (1 + ppm / 1e6)));
        const dur = undone.channels[0].length / undone.sampleRate;
        let best = null;
        let err = null;
        for (const frac of probeAt) {
          const start = Math.min(Math.max(0, dur * frac), Math.max(0, dur - probeSeconds));
          const slice = sliceWindow(undone, start, probeSeconds);
          if (!slice) continue;
          try {
            const r = detectMark(encodeWav(slice));
            if (!best || (r.mean_strength || 0) > best.mean_strength) {
              best = { mean_strength: r.mean_strength || 0, payload_candidate: r.payload_candidate, at: round(start, 1) };
            }
          } catch (e) {
            err = e.message;
          }
        }
        if (!best) {
          rows.push({ offset_ppm: ppm, error: err || 'no probe window available' });
          continue;
        }
        const res = best;
        rows.push({
          offset_ppm: ppm,
          probe_at_seconds: best.at,
          strength: round(res.mean_strength || 0),
          // Whether the probe decoded the right bits, ignoring the gate entirely.
          // This is how we confirm the strength peak is the genuine alignment and
          // not just a loud patch of noise. Scored with the same 2-bit tolerance
          // the consensus stage uses, so the two stages agree on what counts as
          // the mark.
          payload_bits_off: bitsOff(res.payload_candidate, payload),
          payload_exact: bitsOff(res.payload_candidate, payload) <= MAX_CLUSTER_HAMMING,
        });
      }

      const scored = rows.filter((r) => r.strength !== undefined).sort((a, b) => b.strength - a.strength);
      return Response.json({
        action,
        attack: attackKey,
        attack_label: atk.label,
        null_mode: nullMode,
        probe_seconds: probeSeconds,
        ratio_error_ppm: round(((ratioEst - atk.ratio) / atk.ratio) * 1e6, 1),
        rows: rows.sort((a, b) => a.offset_ppm - b.offset_ppm),
        best_offset_ppm: scored.length ? scored[0].offset_ppm : null,
        best_strength: scored.length ? scored[0].strength : null,
        peak_is_genuine: scored.length ? !!scored[0].payload_exact : false,
        note:
          'best_offset_ppm is the correction to feed the multi-window confirm step. peak_is_genuine false ' +
          'means the strength peak did NOT decode the right bits, i.e. the ladder is chasing noise and the ' +
          'range or step needs revisiting.',
      });
    }

    const { attack, payload, markedAudio, suspect } = await setup(body.url, seconds, attackKey, nullMode);

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
        // Grid answer alongside the refit, so the improvement is measurable
        // rather than asserted.
        beta_grid: round(m.beta_grid, 6),
        ratio_error_grid_ppm:
          m.beta_grid > 0 ? round(((1 / m.beta_grid - attack.ratio) / attack.ratio) * 1e6, 1) : null,
        inliers: m.inliers,
        residual_rms_ms: m.residual_rms === null ? null : round(m.residual_rms * 1000, 2),
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

    // ── seeded: the actual end-to-end loop ──────────────────────────────────
    // Unlike `tolerance`, the offsets here are relative to the ratio PRINT
    // ESTIMATED, not to the true one. Nothing in this path is told the answer, so
    // it is the honest test of whether Print can hand the spectral detector a
    // usable seed.
    if (action === 'seeded') {
      const ref = computePrint(toMono(markedAudio), markedAudio.sampleRate);
      const q = computePrint(toMono(suspect), suspect.sampleRate, true);
      const m = matchPrints(q, ref);
      if (!(m.beta > 0)) return Response.json({ error: 'Print returned no usable beta' }, { status: 422 });
      const ratioEst = 1 / m.beta;

      // Beta precision improves with window length, but detection cost does not
      // need to: estimate the warp from the long window, then decode from a short
      // centred slice. That keeps each candidate cheap enough to sweep.
      const detectSeconds = Number(body.detect_seconds) || 12;
      const offsets = Array.isArray(body.offsets_ppm) && body.offsets_ppm.length
        ? body.offsets_ppm
        : [0, 3, -3, 6, -6];

      const rows = [];
      for (const ppm of offsets) {
        const guess = ratioEst * (1 + ppm / 1e6);
        const undone = trimCentered(pitchShiftResample(suspect, -semitonesOf(guess)), detectSeconds);
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
          payload_exact: res.payload_hex === payload,
          mean_strength: round(strength),
          search_gate: round(searchGate),
          passes_search_gate: strength >= searchGate,
        });
      }

      const hits = rows.filter((r) => r.payload_exact && r.passes_search_gate);
      return Response.json({
        action,
        attack: attackKey,
        attack_label: attack.label,
        print_seconds: seconds,
        detect_seconds: detectSeconds,
        expected_payload: payload,
        ratio_estimated: round(ratioEst, 6),
        ratio_true: round(attack.ratio, 6),
        ratio_error_ppm: round(((ratioEst - attack.ratio) / attack.ratio) * 1e6, 1),
        inliers: m.inliers,
        rows,
        recovered: hits.length > 0,
        recovered_at_ppm: hits.map((h) => h.offset_ppm),
      });
    }

    // ── seeded_multi: seeded scan + multi-window evidence combining ─────────
    // The single-window seeded run recovered the exact payload but abstained on
    // strength. This tests whether combining independent windows at the SAME
    // seeded ratio clears the bar without weakening it.
    if (action === 'seeded_multi') {
      const ref = computePrint(toMono(markedAudio), markedAudio.sampleRate);
      const q = computePrint(toMono(suspect), suspect.sampleRate, true);
      const m = matchPrints(q, ref);
      if (!(m.beta > 0)) return Response.json({ error: 'Print returned no usable beta' }, { status: 422 });
      const ratioEst = 1 / m.beta;

      const offsets = Array.isArray(body.offsets_ppm) && body.offsets_ppm.length ? body.offsets_ppm : [0];
      const maxWindows = Number(body.max_windows) || 4;

      const rows = [];
      for (const ppm of offsets) {
        const guess = ratioEst * (1 + ppm / 1e6);
        const undone = pitchShiftResample(suspect, -semitonesOf(guess));
        const r = detectAcrossWindows(undone, { maxWindows });
        rows.push({
          offset_ppm: ppm,
          consensus_payload: r.consensus_payload,
          consensus_exact: r.consensus_payload === payload,
          agreeing_windows: r.agreeing_windows,
          total_windows: r.total_windows,
          mean_strength: round(r.mean_strength || 0),
          per_window_gate: round(r.per_window_gate || 0),
          combined_gate: round(r.combined_gate || 0),
          accepted: !!r.accepted,
          windows_alone: (r.windows || []).map((w) => ({
            at: w.start_seconds,
            payload: w.payload,
            strength: round(w.mean_strength),
            detected_alone: w.detected_alone,
          })),
        });
      }

      const hits = rows.filter((r) => r.accepted && r.consensus_exact);
      return Response.json({
        action,
        attack: attackKey,
        attack_label: attack.label,
        print_seconds: seconds,
        null_mode: nullMode,
        expected_payload: nullMode ? null : payload,
        // In null mode there is no payload to recover, so `accepted` is the entire
        // measurement: every accepted row is a false positive.
        false_positives: nullMode ? rows.filter((r) => r.accepted).length : null,
        ratio_estimated: round(ratioEst, 6),
        ratio_error_ppm: round(((ratioEst - attack.ratio) / attack.ratio) * 1e6, 1),
        rows,
        recovered: hits.length > 0,
        recovered_at_ppm: hits.map((h) => h.offset_ppm),
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}