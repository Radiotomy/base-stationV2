import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { embedMark, parseWav, payloadFromId, BASE_MARK_VERSION } from '../../shared/baseMark.ts';
import { isFlac, decodeFlacToWav } from '../../shared/flacDecoder.ts';

// Automation handler: auto-embeds a BASE Mark into newly created WAV audio assets.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const entityId = payload?.event?.entity_id;
    if (payload?.event?.entity_name !== 'UserAsset' || !entityId) {
      return Response.json({ skipped: true, reason: 'Not a UserAsset event' });
    }

    let data = payload.data;
    if (!data) data = await base44.asServiceRole.entities.UserAsset.get(entityId);
    if (!data) return Response.json({ skipped: true, reason: 'Asset not found' });

    const AUDIO_TYPES = ['track', 'stem', 'master', 'harmony', 'mashup', 'sfx'];
    if (!AUDIO_TYPES.includes(data.asset_type)) {
      return Response.json({ skipped: true, reason: 'Not an audio asset' });
    }
    if (data.metadata?.base_mark) {
      return Response.json({ skipped: true, reason: 'Already marked' });
    }

    const url = data.metadata?.wav_url || data.file_url;
    if (!url) return Response.json({ skipped: true, reason: 'No file URL' });

    const dl = await fetch(url);
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

    const payloadHex = payloadFromId(entityId);
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