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
      const seconds = Math.max(4, Math.min(30, body.seconds || 12));
      const audio = synthesizeBenchmarkSource(seconds);
      const file = new File([encodeWav(audio)], 'smoke-v4-source.wav', { type: 'audio/wav' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

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
      });

      return Response.json({
        attack,
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

    return Response.json({ error: 'action must be start, poll_encode, attack or poll_decode' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}