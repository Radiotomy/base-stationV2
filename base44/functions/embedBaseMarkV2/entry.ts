import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { payloadFromId } from '../../shared/baseMark.ts';
import { packMessage, runV2, v2Model, BASE_MARK_V2_VERSION } from '../../shared/baseMarkV2.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// BASE Mark V2 — embeds the neural (SilentCipher) watermark via the private
// Replicate model. Carries the same 32-bit payload as V1, so V1 and V2 marks
// resolve to the same registry record.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, fileUrl } = await req.json();
    let url = fileUrl;
    let asset = null;

    if (assetId) {
      asset = await base44.entities.UserAsset.get(assetId);
      if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
      url = asset.metadata?.wav_url || asset.file_url;
    }
    if (!url) return Response.json({ error: 'assetId or fileUrl is required' }, { status: 400 });

    let safeUrl;
    try {
      safeUrl = assertSafeUrl(url);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    const payloadHex = payloadFromId(assetId || url);
    const message = packMessage(payloadHex);

    // Neural embed on Replicate (GPU) — output is a temporary URL to the marked WAV
    const output = await runV2({
      action: 'encode',
      audio: safeUrl,
      message: JSON.stringify(message),
    });
    const outUrl = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : output?.url;
    if (!outUrl) return Response.json({ error: 'Model returned no output file' }, { status: 502 });

    // Persist — Replicate delivery URLs expire, so store our own copy
    const dl = await fetch(outUrl);
    if (!dl.ok) return Response.json({ error: 'Could not download the watermarked file from the model' }, { status: 502 });
    const file = new File([await dl.arrayBuffer()], 'basemark-v2.wav', { type: 'audio/wav' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    if (asset) {
      const usedWavSlot = !!asset.metadata?.wav_url;
      const updates = {
        metadata: {
          ...(asset.metadata || {}),
          ...(usedWavSlot ? { wav_url: file_url } : {}),
          base_mark_v2: {
            version: BASE_MARK_V2_VERSION,
            engine: 'neural',
            model: v2Model(),
            payload_hex: payloadHex,
            marked_file_url: file_url,
            original_file_url: url,
            embedded_at: new Date().toISOString(),
          },
        },
      };
      if (!usedWavSlot) updates.file_url = file_url;
      await base44.entities.UserAsset.update(assetId, updates);
    }

    return Response.json({ ok: true, payload_hex: payloadHex, marked_file_url: file_url, version: BASE_MARK_V2_VERSION });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});