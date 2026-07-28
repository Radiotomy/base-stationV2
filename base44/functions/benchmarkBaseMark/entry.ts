import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { embedMark, detectMark, payloadFromId } from '../../shared/baseMark.ts';
import { packMessage, unpackMessage, startV2, getV2Prediction, decodeV2 } from '../../shared/baseMarkV2.ts';
import { ATTACKS, decodeWav, encodeWav, synthesizeBenchmarkSource } from '../../shared/audioAttacks.ts';
import { buildCandidates, detectMarkDesync } from '../../shared/baseMarkSearch.ts';

// BASE Mark robustness benchmark — produces MEASURED per-layer survival numbers
// so public robustness claims can be sourced to real data instead of estimates.
//
// Admin-only: it burns Replicate GPU time on the neural path.
//
// Actions
//   v1_sweep  — measures the SPECTRAL (V1) layer across attacks x trials.
//               Pure DSP, no GPU, free, deterministic. Fast enough to sweep
//               every attack in one call.
//   v2_start  — embeds V1, uploads, then kicks off the V2 neural encode on top
//               (async on Replicate). Returns prediction_id + payload_hex.
//   v2_poll   — resolves the finished V2 encode to a cascaded file URL.
//   v2_attack — applies ONE attack to the cascaded file, then runs BOTH
//               detectors on the result. One GPU decode per call, so attacks are
//               measured one at a time to stay inside the request budget.
//
// Every result row is persisted to BaseMarkBenchmark under a shared run_id.

function attackKeys(requested) {
  const all = Object.keys(ATTACKS);
  if (!Array.isArray(requested) || requested.length === 0) return all;
  const bad = requested.filter((k) => !ATTACKS[k]);
  if (bad.length) throw new Error(`Unknown attack(s): ${bad.join(', ')}`);
  return requested;
}

async function loadSource(base44, fileUrl, seconds) {
  if (!fileUrl) {
    return { audio: synthesizeBenchmarkSource(seconds), kind: 'synthetic' };
  }
  const r = await fetch(fileUrl);
  if (!r.ok) throw new Error(`Could not download benchmark source (${r.status})`);
  return { audio: decodeWav(new Uint8Array(await r.arrayBuffer())), kind: 'uploaded' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action || 'v1_sweep';

    // ── Spectral layer sweep — local, free, all attacks in one pass ──────────
    if (action === 'v1_sweep') {
      const trials = Math.max(1, Math.min(10, body.trials || 2));
      const seconds = Math.max(4, Math.min(30, body.seconds || 6));
      const keys = attackKeys(body.attacks);
      const runId = body.run_id || crypto.randomUUID();
      const { audio, kind } = await loadSource(base44, body.fileUrl, seconds);
      const sourceSeconds = audio.channels[0].length / audio.sampleRate;

      // Pre-embed one marked file per trial (distinct payload each).
      const marked = [];
      for (let t = 0; t < trials; t++) {
        const payloadHex = payloadFromId(`benchmark-${runId}-${t}`);
        marked.push({ payloadHex, bytes: embedMark(encodeWav(audio), payloadHex) });
      }

      const rows = [];
      for (const key of keys) {
        let survived = 0;
        let strengthSum = 0;
        const failures = [];
        for (const m of marked) {
          let res;
          try {
            const attacked = ATTACKS[key].apply(decodeWav(m.bytes));
            res = detectMark(encodeWav(attacked));
          } catch (e) {
            failures.push(e.message);
            continue;
          }
          if (res.detected && res.payload_hex === m.payloadHex) survived++;
          else failures.push(res.detected ? `wrong payload ${res.payload_hex}` : (res.reason || 'not detected'));
          strengthSum += res.mean_strength || 0;
        }
        rows.push({
          run_id: runId,
          layer: 'spectral',
          attack: key,
          attack_label: ATTACKS[key].label,
          trials,
          survived,
          survival_pct: Number(((survived / trials) * 100).toFixed(1)),
          mean_strength: Number((strengthSum / trials).toFixed(4)),
          source_kind: kind,
          source_seconds: Number(sourceSeconds.toFixed(2)),
          sample_rate: audio.sampleRate,
          cascaded: false,
          notes: failures.length ? failures.slice(0, 3).join('; ') : '',
        });
      }

      await base44.asServiceRole.entities.BaseMarkBenchmark.bulkCreate(rows);
      return Response.json({
        run_id: runId,
        layer: 'spectral',
        trials,
        source_kind: kind,
        source_seconds: Number(sourceSeconds.toFixed(2)),
        results: rows.map((r) => ({ attack: r.attack, label: r.attack_label, survival_pct: r.survival_pct, mean_strength: r.mean_strength, notes: r.notes })),
      });
    }

    // ── Desync-search sweep — measures the searching detector against the
    //    plain one on the SAME attacked files, so the delta is attributable. ──
    if (action === 'v1_search') {
      const trials = Math.max(1, Math.min(5, body.trials || 2));
      const seconds = Math.max(4, Math.min(30, body.seconds || 12));
      const keys = attackKeys(body.attacks);
      const runId = body.run_id || crypto.randomUUID();
      const { audio, kind } = await loadSource(base44, body.fileUrl, seconds);
      const candidates = buildCandidates(body.grid || {});

      const marked = [];
      for (let t = 0; t < trials; t++) {
        const payloadHex = payloadFromId(`search-${runId}-${t}`);
        marked.push({ payloadHex, bytes: embedMark(encodeWav(audio), payloadHex) });
      }

      const rows = [];
      const results = [];
      for (const key of keys) {
        let plainOk = 0;
        let searchOk = 0;
        let falsePos = 0;
        const winners = [];
        for (const m of marked) {
          const attacked = encodeWav(ATTACKS[key].apply(decodeWav(m.bytes)));
          let plain = { detected: false, payload_hex: null };
          try { plain = detectMark(attacked); } catch { /* unsupported */ }
          if (plain.detected && plain.payload_hex === m.payloadHex) plainOk++;

          const found = detectMarkDesync(attacked, { candidates });
          if (found.detected && found.payload_hex === m.payloadHex) {
            searchOk++;
            winners.push(found.candidate);
          } else if (found.detected) {
            falsePos++;
          }
        }
        const pct = Number(((searchOk / trials) * 100).toFixed(1));
        rows.push({
          run_id: runId,
          layer: 'spectral',
          attack: key,
          attack_label: `${ATTACKS[key].label} [desync search]`,
          trials,
          survived: searchOk,
          survival_pct: pct,
          source_kind: kind,
          source_seconds: Number((audio.channels[0].length / audio.sampleRate).toFixed(2)),
          sample_rate: audio.sampleRate,
          cascaded: false,
          notes: `plain detector ${((plainOk / trials) * 100).toFixed(0)}%; grid ${candidates.length} candidates; wrong-payload hits ${falsePos}; winners ${winners.join(',') || 'none'}`,
        });
        results.push({
          attack: key,
          label: ATTACKS[key].label,
          plain_pct: Number(((plainOk / trials) * 100).toFixed(1)),
          search_pct: pct,
          wrong_payload_hits: falsePos,
          winning_candidates: winners,
        });
      }

      await base44.asServiceRole.entities.BaseMarkBenchmark.bulkCreate(rows);
      return Response.json({ run_id: runId, layer: 'spectral', mode: 'desync_search', trials, candidates: candidates.length, results });
    }

    // ── Neural path: embed the cascade, then attack it one step at a time ────
    if (action === 'v2_start') {
      const seconds = Math.max(4, Math.min(30, body.seconds || 12));
      const runId = body.run_id || crypto.randomUUID();
      const { audio, kind } = await loadSource(base44, body.fileUrl, seconds);
      const payloadHex = payloadFromId(`benchmark-${runId}-v2`);
      const v1Bytes = embedMark(encodeWav(audio), payloadHex);
      const file = new File([v1Bytes], 'benchmark-v1.wav', { type: 'audio/wav' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const pred = await startV2({ action: 'encode', audio: file_url, message: JSON.stringify(packMessage(payloadHex)) });
      return Response.json({
        run_id: runId,
        payload_hex: payloadHex,
        prediction_id: pred.id,
        v1_marked_url: file_url,
        source_kind: kind,
        note: 'Poll with action:"v2_poll" and this prediction_id to get the cascaded file URL.',
      });
    }

    if (action === 'v2_poll') {
      const pred = await getV2Prediction(body.prediction_id);
      if (pred.status === 'starting' || pred.status === 'processing') {
        return Response.json({ status: pred.status });
      }
      if (pred.status !== 'succeeded') {
        return Response.json({ status: pred.status, error: pred.error || null });
      }
      const url = typeof pred.output === 'string' ? pred.output : Array.isArray(pred.output) ? pred.output[0] : pred.output?.url;
      return Response.json({ status: 'succeeded', cascaded_url: url });
    }

    if (action === 'v2_attack') {
      const { cascaded_url, payload_hex, attack, run_id } = body;
      if (!cascaded_url || !payload_hex || !attack) {
        return Response.json({ error: 'cascaded_url, payload_hex and attack are required' }, { status: 400 });
      }
      if (!ATTACKS[attack]) return Response.json({ error: `Unknown attack: ${attack}` }, { status: 400 });
      const runId = run_id || crypto.randomUUID();

      const dl = await fetch(cascaded_url);
      if (!dl.ok) return Response.json({ error: 'Could not download cascaded file' }, { status: 502 });
      const audio = decodeWav(new Uint8Array(await dl.arrayBuffer()));
      const attackedBytes = encodeWav(ATTACKS[attack].apply(audio));

      // Spectral detector — local.
      let v1 = { detected: false, payload_hex: null, mean_strength: 0 };
      try { v1 = detectMark(attackedBytes); } catch (e) { v1 = { detected: false, payload_hex: null, mean_strength: 0, reason: e.message }; }
      const v1Ok = v1.detected && v1.payload_hex === payload_hex;

      // Neural detector — one GPU decode. Crop-robust decoding for crops.
      let v2Ok = false;
      let v2Note = '';
      try {
        const file = new File([attackedBytes], 'benchmark-attacked.wav', { type: 'audio/wav' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const output = await decodeV2(file_url, { phaseShift: attack.startsWith('crop') });
        const resultUrl = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : output?.url;
        if (resultUrl) {
          const rr = await fetch(resultUrl);
          if (rr.ok) {
            const v2 = await rr.json();
            if (v2.detected && Array.isArray(v2.messages) && v2.messages.length > 0) {
              const { valid, payload_hex: ph } = unpackMessage(v2.messages[0]);
              v2Ok = valid && ph === payload_hex;
              if (valid && !v2Ok) v2Note = `wrong payload ${ph}`;
            } else {
              v2Note = 'not detected';
            }
          }
        }
      } catch (e) {
        v2Note = `decode error: ${e.message}`;
      }

      const base = {
        run_id: runId,
        attack,
        attack_label: ATTACKS[attack].label,
        trials: 1,
        source_seconds: Number((audio.channels[0].length / audio.sampleRate).toFixed(2)),
        sample_rate: audio.sampleRate,
        cascaded: true,
      };
      await base44.asServiceRole.entities.BaseMarkBenchmark.bulkCreate([
        { ...base, layer: 'spectral', survived: v1Ok ? 1 : 0, survival_pct: v1Ok ? 100 : 0, mean_strength: Number((v1.mean_strength || 0).toFixed(4)), notes: v1Ok ? '' : (v1.reason || 'not recovered') },
        { ...base, layer: 'neural', survived: v2Ok ? 1 : 0, survival_pct: v2Ok ? 100 : 0, notes: v2Note },
      ]);

      return Response.json({
        run_id: runId,
        attack,
        label: ATTACKS[attack].label,
        spectral: { survived: v1Ok, mean_strength: Number((v1.mean_strength || 0).toFixed(4)) },
        neural: { survived: v2Ok, note: v2Note },
        combined: v1Ok || v2Ok,
      });
    }

    return Response.json({ error: 'action must be v1_sweep, v1_search, v2_start, v2_poll or v2_attack' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});