import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { embedMark, BASE_MARK_VERSION } from '../../shared/baseMark.ts';
import { derivePayload, derivePayloadForAsset, payloadStamp, PAYLOAD_VERSION_KEYED } from '../../shared/baseMarkPayload.ts';
import { isFlac, decodeFlacToWav } from '../../shared/flacDecoder.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

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

    // SSRF guard — reject non-http(s), IP-literal, loopback, and internal hosts
    let safeUrl;
    try {
      safeUrl = assertSafeUrl(url);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    const dl = await fetch(safeUrl, { redirect: 'error' });
    if (!dl.ok) return Response.json({ error: 'Could not download the audio file' }, { status: 502 });
    let bytes = new Uint8Array(await dl.arrayBuffer());

    if (isFlac(bytes)) bytes = decodeFlacToWav(bytes);

    // Keyed derivation (Phase 1). Collision checking only applies to the asset
    // path — an ad-hoc fileUrl mark is not registered, so there is no registry
    // row for it to collide with and nothing to check against.
    const derived = assetId
      ? await derivePayloadForAsset(base44, assetId)
      : { payload_hex: await derivePayload(url), payload_salt: 0, payload_version: PAYLOAD_VERSION_KEYED };
    const payloadHex = derived.payload_hex;
    const marked = embedMark(bytes, payloadHex);

    const file = new File([marked], 'basemark.wav', { type: 'audio/wav' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    if (asset) {
      // Make the MARKED file canonical in whichever slot the source audio lived
      const usedWavSlot = !!asset.metadata?.wav_url;
      const updates = {
        metadata: {
          ...(asset.metadata || {}),
          ...(usedWavSlot ? { wav_url: file_url } : {}),
          base_mark: {
            version: BASE_MARK_VERSION,
            payload_hex: payloadHex,
            ...payloadStamp(derived),
            marked_file_url: file_url,
            original_file_url: url,
            embedded_at: new Date().toISOString(),
          },
        },
      };
      if (!usedWavSlot) updates.file_url = file_url;
      await base44.entities.UserAsset.update(assetId, updates);
    }

    return Response.json({ ok: true, payload_hex: payloadHex, marked_file_url: file_url, version: BASE_MARK_VERSION });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});