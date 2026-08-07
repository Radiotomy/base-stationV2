import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ATTACKS, decodeWav, encodeWav, synthesizeBenchmarkSource } from '../../shared/audioAttacks.ts';
import { startV4, getV4Prediction, packV4Message, unpackV4Message, v4Model, v4Version } from '../../shared/baseMarkV4.ts';
import { isFlac, decodeFlacToWav } from '../../shared/flacDecoder.ts';

// BASE Mark V4 (Speed Layer) smoke test — the first real exercise of the
// audiowmark container. It answers the two questions the build could not:
// whether our --key file format and our `get` output parsing are actually
// right, and whether the layer survives the re-timing attack that V1, V2 and
// V3 all measurably fail.
//
// Split into steps rather than one round trip: even on CPU, encode + attack +
// speed-searching decode on a 12s clip exceeds a single request's budget, and
// a timeout mid-run tells you nothing about which half broke.
//
//   start        -> synthesize audio, embed the mark, return prediction id
//   poll_encode  -> resolve the marked file (rehosted to real storage)
//   attack       -> apply ONE attack locally, start the decode
//   poll_decode  -> read the decode and compare the recovered payload
//
// Admin-only. It burns Replicate CPU time, and the key it uses is the
// production watermark key.

const TEST_PAYLOAD = 'beefcafe';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'start';

    if (action === 'start') {
      // `source_url` runs the whole thing against a REAL master instead of the
      // synthetic tone. That distinction has already burned us once: V3 looked
      // fine on synthetic audio and then recovered nothing from an actual
      // 48kHz/24-bit master, so a synthetic-only pass is not evidence.
      let file_url = body.source_url || null;
      let seconds = null;
      if (file_url && body.trim_seconds) {
        // Trim so a real master can be measured at the SAME duration V3 was
        // (60s). Different lengths are not comparable — every one of these
        // detectors gets more evidence from a longer file.
        const src = await fetch(file_url);
        if (!src.ok) return Response.json({ error: 'Could not download source_url' }, { status: 502 });
        const b = new Uint8Array(await src.arrayBuffer());
        const audio = decodeWav(isFlac(b) ? decodeFlacToWav(b) : b);
        const n = Math.min(audio.channels[0].length, Math.round(body.trim_seconds * audio.sampleRate));
        const trimmed = { sampleRate: audio.sampleRate, channels: audio.channels.map((c) => c.slice(0, n)) };
        seconds = Number((n / audio.sampleRate).toFixed(2));
        const f = new File([encodeWav(trimmed)], 'v4-master-trim.wav', { type: 'audio/wav' });
        file_url = (await base44.integrations.Core.UploadFile({ file: f })).file_url;
      } else if (!file_url) {
        seconds = Math.max(4, Math.min(30, body.seconds || 12));
        const audio = synthesizeBenchmarkSource(seconds);
        const file = new File([encodeWav(audio)], 'smoke-v4-source.wav', { type: 'audio/wav' });
        file_url = (await base44.integrations.Core.UploadFile({ file })).file_url;
      }

      const payloadHex = body.payload_hex || TEST_PAYLOAD;
      const pred = await startV4({
        audio: file_url,
        mode: 'encode',
        payload_hex: packV4Message(payloadHex),
        key_hex: Deno.env.get('BASE_MARK_V4_KEY'),
      });

      return Response.json({
        model: v4Model(),
        pinned_version: v4Version() ? 'yes' : 'no',
        payload_hex: payloadHex,
        message_hex: packV4Message(payloadHex),
        prediction_id: pred.id,
        source_url: file_url,
        source_kind: body.source_url ? 'uploaded' : 'synthetic',
        source_seconds: seconds,
        note: 'Poll with action:"poll_encode" and this prediction_id.',
      });
    }

    if (action === 'poll_encode') {
      const p = await getV4Prediction(body.prediction_id);
      if (p.status === 'starting' || p.status === 'processing') {
        return Response.json({ status: p.status });
      }
      if (p.status !== 'succeeded') {
        return Response.json({ status: p.status, error: p.error || null, logs: (p.logs || '').slice(-1500) });
      }
      const out = p.output?.audio;
      if (!out) {
        return Response.json({ status: 'succeeded', error: 'V4 returned no audio', output: p.output });
      }
      // Cog hands small outputs back as a base64 data: URI, which cannot be
      // passed to a later prediction — rehost to real storage.
      const dl = await fetch(out);
      if (!dl.ok) return Response.json({ status: 'succeeded', error: 'could not read V4 output' });
      const bytes = new Uint8Array(await dl.arrayBuffer());
      const flac = isFlac(bytes);
      const file = new File([bytes], flac ? 'smoke-v4-marked.flac' : 'smoke-v4-marked.wav', {
        type: flac ? 'audio/flac' : 'audio/wav',
      });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return Response.json({
        status: 'succeeded',
        marked_url: file_url,
        is_flac: flac,
        bytes: bytes.length,
        logs: (p.logs || '').slice(-1500),
      });
    }

    if (action === 'attack') {
      const { marked_url } = body;
      if (!marked_url) return Response.json({ error: 'marked_url is required' }, { status: 400 });

      // `attack: "none"` measures a clean round trip — worth doing FIRST,
      // because a failure there is our key/parsing being wrong rather than the
      // watermark being fragile, and those two look identical from the outside.
      const attack = body.attack || 'none';
      if (attack !== 'none' && !ATTACKS[attack]) {
        return Response.json({ error: `Unknown attack: ${attack}`, available: Object.keys(ATTACKS) }, { status: 400 });
      }

      const dl = await fetch(marked_url);
      if (!dl.ok) return Response.json({ error: 'Could not download marked file' }, { status: 502 });
      const raw = new Uint8Array(await dl.arrayBuffer());

      let wavBytes = raw;
      if (isFlac(raw)) {
        try { wavBytes = decodeFlacToWav(raw); }
        catch (e) { return Response.json({ error: `FLAC decode failed: ${e.message}` }, { status: 500 }); }
      }

      let attackedUrl = marked_url;
      let sourceSeconds = null;
      if (attack === 'none') {
        // Still re-upload as WAV so both paths hand the model the same format.
        const audio = decodeWav(wavBytes);
        sourceSeconds = audio.channels[0].length / audio.sampleRate;
        const f = new File([wavBytes], 'smoke-v4-clean.wav', { type: 'audio/wav' });
        attackedUrl = (await base44.integrations.Core.UploadFile({ file: f })).file_url;
      } else {
        const audio = decodeWav(wavBytes);
        const attacked = ATTACKS[attack].apply(audio);
        sourceSeconds = attacked.channels[0].length / attacked.sampleRate;
        const f = new File([encodeWav(attacked)], 'smoke-v4-attacked.wav', { type: 'audio/wav' });
        attackedUrl = (await base44.integrations.Core.UploadFile({ file: f })).file_url;
      }

      // Speed search on by default for attacked audio — it is the entire
      // reason this layer exists — and off for the clean round trip, where it
      // would only add CPU time.
      const detectSpeed = body.detect_speed ?? (attack !== 'none');
      const dec = await startV4({
        audio: attackedUrl,
        mode: 'decode',
        // Required by the deployed schema even though decode ignores it.
        payload_hex: '0'.repeat(32),
        key_hex: Deno.env.get('BASE_MARK_V4_KEY'),
        detect_speed: detectSpeed,
        patient: Boolean(body.patient),
        // Real encoder pass, done inside the container where ffmpeg lives. Left
        // as its own dimension rather than an ATTACKS entry because the attack
        // registry is deliberately codec-free.
        codec: body.codec || 'none',
      });

      return Response.json({
        attack,
        codec: body.codec || 'none',
        label: attack === 'none' ? 'Clean round trip (no attack)' : ATTACKS[attack].label,
        detect_speed: detectSpeed,
        prediction_id: dec.id,
        attacked_url: attackedUrl,
        source_seconds: sourceSeconds ? Number(sourceSeconds.toFixed(2)) : null,
        note: 'Read the result with action:"poll_decode".',
      });
    }

    if (action === 'poll_decode') {
      const p = await getV4Prediction(body.prediction_id);
      if (p.status === 'starting' || p.status === 'processing') {
        return Response.json({ status: p.status });
      }
      if (p.status !== 'succeeded') {
        return Response.json({ status: p.status, error: p.error || null, logs: (p.logs || '').slice(-2000) });
      }

      const out = p.output || {};
      const expected = body.payload_hex || TEST_PAYLOAD;
      // The container returns ONE recovered 128-bit message as `payload_hex`
      // (already the best of audiowmark's pattern lines) — not a list.
      const message = out.payload_hex || null;
      const { valid: structurallyValid, payload_hex: recovered } = unpackV4Message(message);

      return Response.json({
        status: 'succeeded',
        detected: out.detected === true,
        expected_payload_hex: expected,
        recovered_payload_hex: recovered,
        zero_tail_intact: structurallyValid,
        survived: out.detected === true && structurallyValid && recovered === expected,
        speed: out.speed ?? null,
        confidence: out.confidence ?? null,
        raw_message: message,
        container_note: out.note ?? null,
        logs: (p.logs || '').slice(-2000),
      });
    }

    // ── Grid runner ────────────────────────────────────────────────────────
    // `attack` above measures one attack at a time, which is fine for a probe
    // and impractical for the 19-attack grid. `grid` applies a BATCH of attacks
    // to one marked file and starts every decode at once; `grid_poll` collects
    // them and writes the BaseMarkBenchmark rows.
    //
    // Batched rather than all-19-in-one-shot deliberately: the attacks are
    // applied locally on full-length audio and each result is uploaded, so a
    // 60s master would blow the request budget somewhere in the middle and
    // leave you unable to tell which attacks actually ran.
    if (action === 'grid') {
      const { marked_url } = body;
      if (!marked_url) return Response.json({ error: 'marked_url is required' }, { status: 400 });

      const requested = Array.isArray(body.attacks) && body.attacks.length
        ? body.attacks
        : Object.keys(ATTACKS);
      const unknown = requested.filter((a) => a !== 'none' && !ATTACKS[a]);
      if (unknown.length) {
        return Response.json({ error: `Unknown attacks: ${unknown.join(', ')}`, available: Object.keys(ATTACKS) }, { status: 400 });
      }
      const batch = requested.slice(0, Math.max(1, Math.min(6, body.batch_size || 4)));

      const dl = await fetch(marked_url);
      if (!dl.ok) return Response.json({ error: 'Could not download marked file' }, { status: 502 });
      const raw = new Uint8Array(await dl.arrayBuffer());
      const wavBytes = isFlac(raw) ? decodeFlacToWav(raw) : raw;
      const source = decodeWav(wavBytes);

      const jobs = [];
      for (const attack of batch) {
        const attacked = attack === 'none' ? source : ATTACKS[attack].apply(source);
        const f = new File([encodeWav(attacked)], `v4-${attack}.wav`, { type: 'audio/wav' });
        const url = (await base44.integrations.Core.UploadFile({ file: f })).file_url;
        const dec = await startV4({
          audio: url,
          mode: 'decode',
          payload_hex: '0'.repeat(32),
          key_hex: Deno.env.get('BASE_MARK_V4_KEY'),
          // Speed search on for every attacked row. It costs more CPU, but the
          // point of the grid is to measure what V4 can recover at its best.
          detect_speed: body.detect_speed ?? (attack !== 'none' && attack !== 'control'),
          patient: Boolean(body.patient),
          codec: body.codec || 'none',
        });
        jobs.push({
          attack,
          attack_label: attack === 'none' ? 'Clean round trip (no attack)' : ATTACKS[attack].label,
          prediction_id: dec.id,
          source_url: url,
          sample_rate: attacked.sampleRate,
          source_seconds: Number((attacked.channels[0].length / attacked.sampleRate).toFixed(2)),
        });
      }

      return Response.json({
        started: jobs.length,
        remaining: requested.filter((a) => !batch.includes(a)),
        jobs,
        note: 'Read with action:"grid_poll", passing these jobs and a run_id.',
      });
    }

    if (action === 'grid_poll') {
      const jobs = Array.isArray(body.jobs) ? body.jobs : [];
      if (!jobs.length) return Response.json({ error: 'jobs is required' }, { status: 400 });
      const runId = body.run_id;
      const expected = body.payload_hex || TEST_PAYLOAD;
      const sourceKind = body.source_kind === 'uploaded' ? 'uploaded' : 'synthetic';

      const results = [];
      const rows = [];
      for (const job of jobs) {
        const p = await getV4Prediction(job.prediction_id);
        if (p.status === 'starting' || p.status === 'processing') {
          results.push({ attack: job.attack, status: p.status });
          continue;
        }
        if (p.status !== 'succeeded') {
          results.push({ attack: job.attack, status: p.status, error: p.error || null });
          continue;
        }
        const out = p.output || {};
        const { valid, payload_hex: recovered } = unpackV4Message(out.payload_hex || null);
        const survived = out.detected === true && valid && recovered === expected;
        results.push({
          attack: job.attack,
          status: 'succeeded',
          survived,
          recovered_payload_hex: recovered,
          speed: out.speed ?? null,
          confidence: out.confidence ?? null,
          note: out.note ?? null,
        });
        if (runId) {
          rows.push({
            run_id: runId,
            layer: 'speed',
            attack: job.attack,
            attack_label: job.attack_label || job.attack,
            trials: 1,
            survived: survived ? 1 : 0,
            survival_pct: survived ? 100 : 0,
            confidence: typeof out.confidence === 'number' ? out.confidence : undefined,
            detected_speed: typeof out.speed === 'number' ? out.speed : undefined,
            codec: body.codec || 'none',
            source_kind: sourceKind,
            source_url: job.source_url || undefined,
            source_seconds: job.source_seconds ?? undefined,
            sample_rate: job.sample_rate ?? undefined,
            cascaded: false,
            notes: out.note || undefined,
          });
        }
      }

      // Only written once every job in the batch has resolved, so a re-poll
      // mid-flight cannot leave half a batch recorded and then duplicate it.
      const pending = results.filter((r) => r.status === 'starting' || r.status === 'processing').length;
      let recorded = 0;
      if (runId && !pending && rows.length) {
        await base44.asServiceRole.entities.BaseMarkBenchmark.bulkCreate(rows);
        recorded = rows.length;
      }

      return Response.json({ pending, recorded, results });
    }

    // ── Phase 0: null corpus (false-positive rate) ─────────────────────────
    // Every V4 figure we have so far is a TRUE-positive rate. A forensic claim
    // needs the other half: what the detector does with audio that carries no
    // watermark at all. The "spurious floor 0.72" we currently cite was observed
    // incidentally on failed recoveries of MARKED files — it has never been
    // measured on a clean corpus, so it is not yet a false-positive rate and the
    // acceptance threshold derived from it is not yet calibrated.
    //
    // Speed search is forced ON here. That is the point: --detect-speed re-times
    // the audio and decodes repeatedly across a search space, which is by far the
    // most likely path to a hallucinated pattern line. Measuring the null rate
    // with speed search off would flatter the layer and measure a path we do not
    // ship.
    //
    // A single structurally valid payload out of unmarked audio invalidates the
    // threshold. That is the result this phase exists to find.
    if (action === 'null_scan') {
      // Sources are either plain URLs (our own lossless masters) or
      // { url, seconds } objects — the outside-sourced path knows each clip's
      // duration up front and hands it through.
      const sources = (Array.isArray(body.sources) ? body.sources : [])
        .filter(Boolean)
        .map((s) => (typeof s === 'string' ? { url: s, seconds: null } : { url: s.url, seconds: s.seconds ?? null }))
        .filter((s) => s.url);
      if (!sources.length) {
        return Response.json({ error: 'sources must be a non-empty array of unmarked audio URLs' }, { status: 400 });
      }

      const wantedSeconds = body.seconds || 60;
      // Length gate. A shorter scan is a measurably EASIER scan, so letting an
      // under-length clip through would quietly bias the null rate toward clean —
      // the exact direction that would flatter the layer. Anything short is
      // rejected and reported rather than scanned.
      const minSeconds = wantedSeconds * 0.9;
      // Outside material arrives as lossy MP3 previews, which this runtime cannot
      // decode (see the mp3Decode dead end — the WASM decoders hang on Deno).
      // Passthrough hands the URL straight to the container, whose ffmpeg
      // normalizes it to PCM before scanning, so no local decode is needed.
      const passthrough = Boolean(body.passthrough);
      const codec = body.codec || 'none';
      // Our own generated audio is overwhelmingly DELIVERED as a lossy format, so
      // a lossless-only null figure would describe the rarest case. Once a real
      // encoder is in the path the row belongs in its own class — codec damage is
      // what eats the decision margin, and blending it with PCM hides the case
      // most likely to produce a spurious hit.
      const sourceClass =
        body.source_class ||
        (passthrough ? 'human_lossy_preview' : codec !== 'none' ? 'ai_generated_codec' : 'ai_generated_wav');
      const batch = sources.slice(0, Math.max(1, Math.min(6, body.batch_size || 4)));

      const jobs = [];
      for (const src of batch) {
        let scanUrl = src.url;
        let sampleRate = null;
        let seconds = src.seconds;

        if (passthrough) {
          if (seconds == null || seconds < minSeconds) {
            jobs.push({
              source_url: src.url,
              error: `rejected by the ${wantedSeconds}s length gate (${seconds ?? 'unknown'}s)`,
            });
            continue;
          }
        } else {
          // Normalized to WAV at a fixed duration so every null row in this class
          // is comparable to every other one.
          //
          // `range_bytes` downloads only the LEADING portion of the file. Real
          // lossless masters are 24-bit/96kHz and minutes long; pulling one whole
          // and decoding it would allocate hundreds of MB in this runtime for
          // audio we then throw away down to 60s. The FLAC decoder tolerates the
          // truncated tail and is additionally capped to the duration we want,
          // so memory stays bounded regardless of how long the source is.
          const dl = await fetch(
            src.url,
            body.range_bytes ? { headers: { Range: `bytes=0-${Math.max(1, body.range_bytes) - 1}` } } : undefined,
          );
          if (!dl.ok && dl.status !== 206) {
            jobs.push({ source_url: src.url, error: `could not download (${dl.status})` });
            continue;
          }
          const raw = new Uint8Array(await dl.arrayBuffer());
          let audio;
          try {
            // Decode a little past the target so the length gate below is judged
            // on real available audio rather than on where the decode cap landed.
            audio = decodeWav(isFlac(raw) ? decodeFlacToWav(raw, wantedSeconds * 1.05) : raw);
          } catch (e) {
            jobs.push({ source_url: src.url, error: `decode failed: ${e.message}` });
            continue;
          }
          const available = audio.channels[0].length / audio.sampleRate;
          if (available < minSeconds) {
            jobs.push({
              source_url: src.url,
              error: `rejected by the ${wantedSeconds}s length gate (${available.toFixed(2)}s available)`,
            });
            continue;
          }
          const n = Math.min(audio.channels[0].length, Math.round(wantedSeconds * audio.sampleRate));
          const trimmed = { sampleRate: audio.sampleRate, channels: audio.channels.map((c) => c.slice(0, n)) };
          const f = new File([encodeWav(trimmed)], 'v4-null.wav', { type: 'audio/wav' });
          scanUrl = (await base44.integrations.Core.UploadFile({ file: f })).file_url;
          sampleRate = trimmed.sampleRate;
          seconds = Number((n / trimmed.sampleRate).toFixed(2));
        }

        const dec = await startV4({
          audio: scanUrl,
          mode: 'decode',
          payload_hex: '0'.repeat(32),
          key_hex: Deno.env.get('BASE_MARK_V4_KEY'),
          detect_speed: true,
          patient: Boolean(body.patient),
          codec,
        });
        jobs.push({
          source_url: src.url,
          prediction_id: dec.id,
          sample_rate: sampleRate,
          source_seconds: seconds,
          source_class: sourceClass,
          codec,
        });
      }

      return Response.json({
        started: jobs.filter((j) => j.prediction_id).length,
        rejected: jobs.filter((j) => j.error).length,
        source_class: sourceClass,
        remaining: sources.filter((s) => !batch.includes(s)).map((s) => ({ url: s.url, seconds: s.seconds })),
        jobs,
        note: 'Read with action:"null_poll", passing these jobs and a run_id.',
      });
    }

    if (action === 'null_poll') {
      const jobs = (Array.isArray(body.jobs) ? body.jobs : []).filter((j) => j.prediction_id);
      if (!jobs.length) return Response.json({ error: 'jobs is required' }, { status: 400 });
      const runId = body.run_id;

      const results = [];
      const rows = [];
      for (const job of jobs) {
        const p = await getV4Prediction(job.prediction_id);
        if (p.status === 'starting' || p.status === 'processing') {
          results.push({ source_url: job.source_url, status: p.status });
          continue;
        }
        if (p.status !== 'succeeded') {
          results.push({ source_url: job.source_url, status: p.status, error: p.error || null });
          continue;
        }

        const out = p.output || {};
        const { valid, payload_hex: recovered } = unpackV4Message(out.payload_hex || null);
        // A false positive is a payload that is STRUCTURALLY VALID — correct
        // length with the zero tail intact. A garbage pattern line that fails
        // that check is a near miss worth recording, not a false attribution,
        // because the production gate would reject it on structure alone.
        const falsePositive = out.detected === true && valid;
        // Only meaningful when the detector actually returned a pattern line. On
        // a clean miss the container reports confidence 0, which would otherwise
        // be recorded as a bit-error of 1.0 — a fabricated data point that would
        // drag the null distribution and make the threshold look safer than it is.
        const bitError =
          out.detected === true && typeof out.confidence === 'number'
            ? Number((1 - out.confidence).toFixed(4))
            : null;

        results.push({
          source_url: job.source_url,
          status: 'succeeded',
          any_pattern_line: out.detected === true,
          false_positive: falsePositive,
          spurious_payload_hex: out.detected === true ? recovered : null,
          zero_tail_intact: valid,
          bit_error: bitError,
          speed: out.speed ?? null,
          note: out.note ?? null,
        });

        if (runId) {
          rows.push({
            run_id: runId,
            layer: 'speed',
            attack: 'null_unmarked',
            attack_label: 'Null corpus — unmarked audio, speed search on',
            trials: 1,
            survived: 0,
            // Always 0: there is no payload in this audio to recover, so this
            // field is meaningless here and false_positive carries the result.
            survival_pct: 0,
            confidence: typeof out.confidence === 'number' ? out.confidence : undefined,
            bit_error: bitError ?? undefined,
            false_positive: falsePositive,
            detected_speed: typeof out.speed === 'number' ? out.speed : undefined,
            // Delivery format is the primary reporting axis for this corpus, so it
            // is a column. Left in notes it could not be grouped on.
            codec: job.codec || body.codec || 'none',
            source_kind: body.source_kind === 'synthetic' ? 'synthetic' : 'uploaded',
            // Carried per job so a mixed batch stays separable, and so the
            // false-positive rate can be reported per class rather than blended.
            source_class: job.source_class || body.source_class || undefined,
            // Recorded so this exact measurement can be re-run at another codec
            // later without re-uploading the audio — the lossy cell is the one
            // that governs the production gate, and it was previously
            // unreachable for any batch whose URLs had left the session.
            source_url: job.source_url || undefined,
            source_seconds: job.source_seconds ?? undefined,
            sample_rate: job.sample_rate ?? undefined,
            cascaded: false,
            notes: [
              'NULL ROW — unmarked audio; a detection here is a failure, not a success.',
              out.note || '',
            ].filter(Boolean).join(' — '),
          });
        }
      }

      const pending = results.filter((r) => r.status === 'starting' || r.status === 'processing').length;
      let recorded = 0;
      if (runId && !pending && rows.length) {
        await base44.asServiceRole.entities.BaseMarkBenchmark.bulkCreate(rows);
        recorded = rows.length;
      }

      const resolved = results.filter((r) => r.status === 'succeeded');
      const falsePositives = resolved.filter((r) => r.false_positive).length;
      return Response.json({
        pending,
        recorded,
        // Batch-level summary only. The corpus-wide rate is the aggregate across
        // every batch of the run — read it back off the entity by run_id rather
        // than treating any single batch as the answer.
        batch_summary: {
          scanned: resolved.length,
          false_positives: falsePositives,
          any_pattern_line: resolved.filter((r) => r.any_pattern_line).length,
          min_bit_error: resolved.reduce((m, r) => (r.bit_error != null && (m == null || r.bit_error < m) ? r.bit_error : m), null),
        },
        results,
      });
    }

    return Response.json(
      { error: 'action must be start, poll_encode, attack, poll_decode, grid, grid_poll, null_scan or null_poll' },
      { status: 400 },
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}