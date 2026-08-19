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
import { toMono, trimFromStart, round } from '../../shared/audioBenchUtils.ts';
import { durationBracket, decodeForPrint } from '../../shared/printRegistry.ts';
import { extractPrintRemote } from '../../shared/printExtractRemote.ts';

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

// dither=true is for QUERY prints only. References are stored undithered so the
// registry blob stays one size; the query pays the 2-4x hash cost in memory.
function printOf(audio, dither = false) {
  return computePrint(toMono(audio), audio.sampleRate, dither);
}

async function loadWav(url, seconds) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not fetch source (${r.status})`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  // decodeForPrint = WAV or FLAC, same decode path the registry itself uses.
  // Speech null-corpus material from Archive.org ships as FLAC, and measuring
  // it through a different decoder than production would taint the calibration.
  return trimFromStart(decodeForPrint(bytes), seconds);
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

    // ── parity ─────────────────────────────────────────────────────────────
    // Cross-implementation check: the Replicate container (predict.py) must
    // produce the SAME hashes as the TS path (basePrint.ts) on the same file.
    // Run this after every container rebuild, on a WAV or FLAC the runtime can
    // also decode — no remote print is trusted for storage or matching until
    // this agrees. Small residual disagreement can only come from decode-stage
    // float differences; a large one means a constant drifted, which is fatal.
    if (action === 'parity') {
      if (!body.url) return Response.json({ error: 'url is required for a parity run' }, { status: 400 });
      const audio = await loadWav(body.url, seconds);
      const local = printOf(audio); // undithered — same as a stored reference
      const remote = await extractPrintRemote(body.url, { maxSeconds: seconds });
      if (!remote.ok) {
        return Response.json({ ok: false, reason: remote.reason, detail: remote.detail || null }, { status: 502 });
      }
      // Exact (hash, anchor-ms) pairs — the strictest possible comparison.
      const key = (h) => `${h.hash}:${Math.round(h.t * 1000)}`;
      const pool = new Map();
      for (const h of local) pool.set(key(h), (pool.get(key(h)) || 0) + 1);
      let common = 0;
      for (const h of remote.hashes) {
        const k = key(h);
        const c = pool.get(k);
        if (c) { common++; pool.set(k, c - 1); }
      }
      const agreement = round((100 * common) / Math.max(1, Math.max(local.length, remote.hashes.length)), 2);
      return Response.json({
        action,
        seconds,
        local_hashes: local.length,
        remote_hashes: remote.hashes.length,
        exact_matches: common,
        agreement_pct: agreement,
        verdict: agreement >= 99 ? 'parity' : agreement >= 90 ? 'near_parity_investigate' : 'DIVERGED_do_not_trust_remote_prints',
        note:
          'Compared on exact (hash, anchor-time) pairs. >=99% = decode-stage float noise only, remote prints ' +
          'are trustworthy. Below that, a constant or a rounding rule has drifted between predict.py and ' +
          'basePrint.ts — fix the mirror and rebuild before storing any remote print.',
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

    // ── speech_specificity ─────────────────────────────────────────────────
    // The measurement that gates the whole podcast plan.
    //
    // Everything known about the Print Layer was measured on MUSIC at 20
    // seconds: n=6, 30 cross-matched unrelated pairs. Podcasts violate both
    // conditions at once. Spoken-word mono is spectrally sparser — fewer
    // transients per second, real silence between phrases — so the extractor's
    // rank-cull to a fixed peaks/second density may be culling from a much
    // thinner candidate pool, and long-form material means far more hashes per
    // reference, which raises the collision count that the geometric check has
    // to survive.
    //
    // TWO CORPORA, REPORTED SEPARATELY, deliberately never pooled. Freesound /
    // Archive.org speech is provenance-independent of BASE Station, and ORVO
    // back-catalog episodes are the real delivery format. Pooling them would let
    // a good rate on one hide a bad rate on the other, which is exactly the
    // small-sample trap that made the first lift calibration wrong.
    //
    // Per-bracket reporting matters for the same reason: a false-positive rate
    // averaged across a 30-second clip and a 45-minute episode describes neither.
    if (action === 'speech_specificity') {
      const groups = [
        { corpus: 'freesound_archive', sources: Array.isArray(body.freesound_sources) ? body.freesound_sources : [] },
        { corpus: 'orvo_catalog', sources: Array.isArray(body.orvo_sources) ? body.orvo_sources : [] },
      ].filter((g) => g.sources.length > 0);

      if (!groups.length) {
        return Response.json(
          { error: 'Provide freesound_sources and/or orvo_sources — each an array of { id, url }.' },
          { status: 400 },
        );
      }

      const report = [];
      for (const group of groups) {
        if (group.sources.length < 3) {
          report.push({
            corpus: group.corpus,
            error: 'A null distribution needs at least 3 unrelated sources to cross-match.',
            provided: group.sources.length,
          });
          continue;
        }

        const prints = [];
        for (const s of group.sources) {
          try {
            const audio = await loadWav(s.url, seconds);
            const dur = audio.channels[0].length / audio.sampleRate;
            const ref = printOf(audio);
            prints.push({
              id: s.id || s.url,
              hashes: ref,
              query: printOf(audio, true),
              duration_seconds: round(dur, 1),
              bracket: durationBracket(dur),
              hashes_per_second: round(ref.length / Math.max(1, dur), 1),
            });
          } catch (e) {
            report.push({ corpus: group.corpus, source: s.id || s.url, error: e.message });
          }
        }
        if (prints.length < 3) {
          report.push({ corpus: group.corpus, error: 'Fewer than 3 sources loaded successfully.', loaded: prints.length });
          continue;
        }

        const rows = [];
        let worstUnrelated = 0;
        let falseAccepts = 0;
        for (const q of prints) {
          const others = prints.filter((p) => p.id !== q.id);
          const self = matchPrints(q.query, q.hashes);
          const ranked = matchAgainstMany(q.query, others);
          const top = ranked[0] || { lift: 0, votes: 0, beta: 1, accepted: false, id: null };
          if (top.lift > worstUnrelated) worstUnrelated = top.lift;
          if (top.accepted) falseAccepts++;
          rows.push({
            id: q.id,
            bracket: q.bracket,
            duration_seconds: q.duration_seconds,
            // The density diagnostic. If speech yields dramatically fewer
            // hashes/second than music, the extractor is starved of evidence and
            // that is the finding — NOT a reason to tune the rank-cull, which
            // stays untouched until measured across enough material to justify a
            // change.
            hashes_per_second: q.hashes_per_second,
            ref_hashes: q.hashes.length,
            self_lift: round(self.lift, 2),
            top_unrelated_id: top.id,
            top_unrelated_lift: round(top.lift, 2),
            top_unrelated_votes: top.votes,
            top_unrelated_beta: round(top.beta, 5),
            // A spurious fit was wrong by 49-79% on music. If speech produces
            // unrelated fits with ACCURATE-looking betas, the geometric
            // discriminator has failed on speech and the seeded path must not
            // ship for podcasts at all.
            top_unrelated_beta_at_boundary: top.beta_at_boundary,
            top_unrelated_accepted: top.accepted,
          });
        }

        // Per-bracket breakdown, so long_form is never averaged with short.
        const brackets = {};
        for (const r of rows) {
          const b = (brackets[r.bracket] = brackets[r.bracket] || {
            n: 0, strongest_unrelated_lift: 0, false_accepts: 0, mean_hashes_per_second: 0,
          });
          b.n++;
          b.false_accepts += r.top_unrelated_accepted ? 1 : 0;
          b.mean_hashes_per_second += r.hashes_per_second;
          if (r.top_unrelated_lift > b.strongest_unrelated_lift) b.strongest_unrelated_lift = r.top_unrelated_lift;
        }
        for (const b of Object.values(brackets)) {
          b.mean_hashes_per_second = round(b.mean_hashes_per_second / b.n, 1);
        }

        report.push({
          corpus: group.corpus,
          sources: prints.length,
          cross_matches: prints.length * (prints.length - 1),
          rows,
          brackets,
          summary: {
            strongest_unrelated_lift: round(worstUnrelated, 2),
            false_accepts_at_provisional_threshold: falseAccepts,
            weakest_self_lift: round(Math.min(...rows.map((r) => r.self_lift)), 2),
          },
        });
      }

      return Response.json({
        action,
        seconds,
        corpora: report,
        note:
          'GATE MEASUREMENT. strongest_unrelated_lift per corpus and per bracket is the floor any speech ' +
          'acceptance rule must clear, and it must be compared against WARPED genuine lifts from a speech ' +
          'recall run — never against self_lift, which is a trivially perfect upper bound. On music these ' +
          'distributions OVERLAPPED, which is why lift was demoted to candidate generation only. If speech ' +
          'overlaps too, the Print-seeded episode path stays advisory permanently and must not be promoted. ' +
          'The two corpora are reported separately on purpose: do not pool them.',
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