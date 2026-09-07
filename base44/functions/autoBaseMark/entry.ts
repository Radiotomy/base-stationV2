import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { embedMark, parseWav, BASE_MARK_VERSION } from '../../shared/baseMark.ts';
import { derivePayloadForAsset, payloadStamp } from '../../shared/baseMarkPayload.ts';
import { isFlac, decodeFlacToWav } from '../../shared/flacDecoder.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// Automation handler: auto-embeds a BASE Mark into newly created WAV audio assets.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const entityId = payload?.event?.entity_id;
    const isAutomation = payload?.event?.entity_name === 'UserAsset';

    // The entity workflow runs with NO signed-in user, so an unconditional admin
    // check locks the automation out of its own job (403 on every create). Any
    // OTHER caller must be an admin. Same gate autoBaseMarkV2 uses.
    if (!isAutomation) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }
    if (!isAutomation || !entityId) {
      return Response.json({ skipped: true, reason: 'Not a UserAsset event' });
    }

    // The automation body is caller-supplied and authorises nothing, so every
    // gate below is re-derived from the STORED record — never from the payload.
    const data = await base44.asServiceRole.entities.UserAsset.get(entityId).catch(() => null);
    if (!data) return Response.json({ skipped: true, reason: 'Asset not found' });

    // Anything older than this window is a replay, not a new asset. Combined with
    // the "already marked" check below, the open path can only ever do work the
    // create event was about to do anyway.
    const ageMs = Date.now() - new Date(data.created_date).getTime();
    if (!(ageMs >= 0 && ageMs < 30 * 60 * 1000)) {
      return Response.json({ skipped: true, reason: 'Asset not newly created' });
    }

    const AUDIO_TYPES = ['track', 'stem', 'master', 'harmony', 'mashup', 'sfx'];
    if (!AUDIO_TYPES.includes(data.asset_type)) {
      return Response.json({ skipped: true, reason: 'Not an audio asset' });
    }
    if (data.metadata?.base_mark) {
      return Response.json({ skipped: true, reason: 'Already marked' });
    }

    const url = data.metadata?.wav_url || data.file_url;
    if (!url) return Response.json({ skipped: true, reason: 'No file URL' });

    // The stored URL is caller-influenced (a creator controls file_url on the
    // assets they create), so it is validated before any server-side fetch —
    // otherwise this function is a proxy for probing internal addresses and cloud
    // metadata endpoints. Same guard autoBaseMarkV2 applies.
    let safeUrl;
    try {
      safeUrl = assertSafeUrl(url);
    } catch (e) {
      return Response.json({ skipped: true, reason: 'Unsafe url: ' + e.message });
    }

    const dl = await fetch(safeUrl);
    if (!dl.ok) return Response.json({ skipped: true, reason: 'Could not download audio' });
    let bytes = new Uint8Array(await dl.arrayBuffer());

    if (isFlac(bytes)) {
      try {
        bytes = decodeFlacToWav(bytes);
      } catch (e) {
        return Response.json({ skipped: true, reason: 'FLAC decode failed: ' + e.message });
      }
    }
    const wav = parseWav(bytes);
    if (!wav || wav.audioFormat !== 1 || (wav.bitsPerSample !== 16 && wav.bitsPerSample !== 24)) {
      return Response.json({ skipped: true, reason: 'Not a PCM WAV or FLAC — auto-marking applies to WAV/FLAC masters only' });
    }

    // Keyed + collision-checked (Phase 1). Throws rather than minting a payload
    // that already identifies a different asset.
    const derived = await derivePayloadForAsset(base44, entityId);
    const payloadHex = derived.payload_hex;
    const marked = embedMark(bytes, payloadHex);

    const file = new File([marked], 'basemark.wav', { type: 'audio/wav' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    // Re-fetch for freshest state (persistExternalMedia may have run in parallel),
    // then make the MARKED file the canonical audio in whichever slot the source lived.
    const fresh = await base44.asServiceRole.entities.UserAsset.get(entityId).catch(() => null);
    const meta = (fresh?.metadata || data.metadata || {});
    const usedWavSlot = !!meta.wav_url;
    const updates = {
      metadata: {
        ...meta,
        ...(usedWavSlot ? { wav_url: file_url } : {}),
        base_mark: {
          version: BASE_MARK_VERSION,
          payload_hex: payloadHex,
          ...payloadStamp(derived),
          marked_file_url: file_url,
          original_file_url: url,
          embedded_at: new Date().toISOString(),
          auto: true,
        },
      },
    };
    if (!usedWavSlot) updates.file_url = file_url;
    await base44.asServiceRole.entities.UserAsset.update(entityId, updates);

    return Response.json({ ok: true, asset_id: entityId, payload_hex: payloadHex, marked_file_url: file_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});