// BASE Mark — Print Layer measurement harness. Admin only.
//
// Deliberately ordered so the measurement most likely to KILL the design runs
// first and cheapest. The Print Layer's hashes are built from ratios, which is
// what buys invariance to pitch shift and tempo stretch and simultaneously makes
// them much less discriminative than absolute hashing. If unrelated tracks score
// comparably to genuine matches, no amount of threshold tuning saves it and the
// honest outcome is to abandon the approach — the same call already made on
// FSVC, on tempo-stretch inversion and on the V3 drift claim.
//
// Actions:
//   selftest    — synthetic material, no uploads. Validates the pipeline end to
//                 end only. Its material is a harmonic drone with almost no
//                 transients, so its RECALL numbers are meaningless as evidence.
//   specificity — the kill-shot test. Cross-matches unrelated real tracks and
//                 reports the null score distribution.
//   recall      — attack-grid recall for ONE real track against itself.
//
// Nothing here writes to BaseMarkBenchmark. That entity's schema is built around
// payload recovery (survival_pct, bit_error) and a Print match recovers no
// payload, so a Print row stored there would be misread as a failed recovery —
// exactly the ambiguity the null_unmarked rows already have to warn about.
// Results are returned for inspection; persistence comes after the design earns
// it, per the storage note in BASE_FINGERPRINT_DESIGN.md.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { decodeWav, ATTACKS, synthesizeBenchmarkSource } from '../../shared/audioAttacks.ts';
import { computePrint } from '../../shared/basePrint.ts';
import { matchPrints, matchAgainstMany } from '../../shared/basePrintMatch.ts';

// Attacks worth measuring for the Print Layer. The two stretch rows and the
// off-grid pitch row are the entire point — those are the cells where every Mark
// Layer measures 0%. The codec-damage and crop rows are the control: a
// fingerprint that is WORSE than the watermark on damage it already survives is
// not a useful complement, so they have to be measured too, not assumed.
const DEFAULT_ATTACKS = [
  'control',
  'pitch_up_1',
  'pitch_up_2',
  'pitch_up_37c',
  'resample_48_441',
  'stretch_105',
  'stretch_095',
  'lowpass_11k',
  'bitcrush_8',
  'noise_10db',
  'crop_5s',
];

// Expected warp factor per attack, so beta accuracy is directly visible instead
// of inferred. A pitch shift by resampling changes duration INVERSELY to the
// frequency ratio, so query time = ref time / ratio and beta = 1/ratio.
function expectedBeta(id) {
  if (id === 'control' || id === 'lowpass_11k' || id === 'bitcrush_8' || id === 'noise_10db' || id === 'crop_5s') {
    return 1;
  }
  if (id === 'stretch_105') return 1.05;
  if (id === 'stretch_095') return 0.95;
  if (id === 'pitch_up_1') return 1 / Math.pow(2, 1 / 12);
  if (id === 'pitch_up_2') return 1 / Math.pow(2, 2 / 12);
  if (id === 'pitch_up_37c') return 1 / Math.pow(2, 0.37 / 12);
  if (id === 'resample_48_441') return 44100 / 48000;
  return null;
}

function trim(audio, seconds) {
  if (!seconds) return audio;
  const want = Math.floor(seconds * audio.sampleRate);
  if (audio.channels[0].length <= want) return audio;
  return { sampleRate: audio.sampleRate, channels: audio.channels.map((c) => c.slice(0, want)) };
}

function toMono(audio) {
  const ch = audio.channels;
  if (ch.length === 1) return ch[0];
  const n = ch[0].length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < ch.length; c++) s += ch[c][i];
    out[i] = s / ch.length;
  }
  return out;
}

// dither=true is for QUERY prints only. References are stored undithered so the
// registry blob stays one size; the query pays the 2-4x hash cost in memory.
function printOf(audio, dither = false) {
  return computePrint(toMono(audio), audio.sampleRate, dither);
}

async function loadWav(url, seconds) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not fetch source (${r.status})`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  return trim(decodeWav(bytes), seconds);
}

function round(v, n = 4) {
  return Number(Number(v).toFixed(n));
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'selftest';
    const seconds = Number(body.seconds) || 20;

    // ── selftest ───────────────────────────────────────────────────────────
    if (action === 'selftest') {
      const src = synthesizeBenchmarkSource(seconds, 44100);
      const ref = printOf(src);
      const rows = [];
      for (const id of ['control', 'pitch_up_2', 'stretch_105']) {
        const q = printOf(ATTACKS[id].apply(src), true);
        const m = matchPrints(q, ref);
        rows.push({
          attack: id,
          query_hashes: q.length,
          votes: m.votes,
          lift: round(m.lift, 2),
          score: round(m.score),
          beta: round(m.beta, 5),
          expected_beta: round(expectedBeta(id), 5),
          accepted: m.accepted,
        });
      }
      return Response.json({
        action,
        reference_hashes: ref.length,
        hashes_per_second: round(ref.length / seconds, 1),
        rows,
        note:
          'Pipeline validation only. The synthetic source is a sustained harmonic drone with almost no ' +
          'transients, so its peak structure is a set of steady horizontal lines and its time ratios are ' +
          'degenerate. Treat non-zero recall here as evidence the code RUNS, not that the method works. ' +
          'Real music is required for any recall figure.',
      });
    }

    // ── specificity (run this before anything else) ────────────────────────
    if (action === 'specificity') {
      const sources = Array.isArray(body.sources) ? body.sources : [];
      if (sources.length < 3) {
        return Response.json(
          { error: 'Provide at least 3 unrelated sources — a null distribution needs cross-matches to measure.' },
          { status: 400 },
        );
      }
      const prints = [];
      for (const s of sources) {
        const audio = await loadWav(s.url, seconds);
        prints.push({ id: s.id || s.url, hashes: printOf(audio), query: printOf(audio, true) });
      }

      const rows = [];
      let worstUnrelated = 0;
      let minSelf = Infinity;
      let falseAccepts = 0;
      for (const q of prints) {
        const others = prints.filter((p) => p.id !== q.id);
        const self = matchPrints(q.query, q.hashes);
        const ranked = matchAgainstMany(q.query, others);
        const top = ranked[0] || { lift: 0, score: 0, votes: 0, beta: 1, accepted: false, id: null };
        if (top.lift > worstUnrelated) worstUnrelated = top.lift;
        if (self.lift < minSelf) minSelf = self.lift;
        if (top.accepted) falseAccepts++;
        rows.push({
          id: q.id,
          ref_hashes: q.hashes.length,
          query_hashes: q.query.length,
          self_lift: round(self.lift, 2),
          self_votes: self.votes,
          top_unrelated_id: top.id,
          top_unrelated_lift: round(top.lift, 2),
          top_unrelated_votes: top.votes,
          top_unrelated_beta: round(top.beta, 5),
          top_unrelated_beta_at_boundary: top.beta_at_boundary,
          top_unrelated_accepted: top.accepted,
        });
      }

      // The margin is the whole measurement. A large gap means a threshold
      // exists; a small or negative gap means no threshold can separate genuine
      // matches from unrelated audio and the design is dead as specified.
      return Response.json({
        action,
        sources: prints.length,
        seconds,
        rows,
        summary: {
          weakest_self_lift: round(minSelf, 2),
          strongest_unrelated_lift: round(worstUnrelated, 2),
          false_accepts_at_provisional_threshold: falseAccepts,
        },
        note:
          'strongest_unrelated_lift is the number that decides the design: it is the floor any acceptance ' +
          'threshold must clear, and it must be compared against the WARPED genuine lifts from a recall ' +
          'run — not against self-match lift, which is a trivially perfect upper bound.',
      });
    }

    // ── recall ─────────────────────────────────────────────────────────────
    if (action === 'recall') {
      if (!body.url) return Response.json({ error: 'url is required for a recall run' }, { status: 400 });
      const attacks = Array.isArray(body.attacks) && body.attacks.length ? body.attacks : DEFAULT_ATTACKS;
      const src = await loadWav(body.url, seconds);
      const ref = printOf(src);
      if (!ref.length) return Response.json({ error: 'No landmarks extracted — source may be silent or too short.' }, { status: 400 });

      const rows = [];
      for (const id of attacks) {
        const def = ATTACKS[id];
        if (!def) {
          rows.push({ attack: id, error: 'unknown attack id' });
          continue;
        }
        const q = printOf(def.apply(src), true);
        const m = matchPrints(q, ref);
        const exp = expectedBeta(id);
        rows.push({
          attack: id,
          label: def.label,
          query_hashes: q.length,
          pairs: m.pairs,
          votes: m.votes,
          lift: round(m.lift, 2),
          beta_at_boundary: m.beta_at_boundary,
          beta: round(m.beta, 5),
          expected_beta: exp === null ? null : round(exp, 5),
          beta_error_pct: exp === null ? null : round(((m.beta - exp) / exp) * 100, 3),
          accepted: m.accepted,
        });
      }
      return Response.json({
        action,
        seconds,
        reference_hashes: ref.length,
        hashes_per_second: round(ref.length / seconds, 1),
        rows,
        note:
          'Recall is only interpretable alongside a specificity run on the same material — a matcher that ' +
          'accepts everything scores 100% here. beta_error_pct is the number that decides whether the ' +
          'warp estimate is accurate enough to hand back to the spectral detector for a targeted retry.',
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}