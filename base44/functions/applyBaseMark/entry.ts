import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { embedMark, payloadFromId, BASE_MARK_VERSION } from '../../shared/baseMark.ts';

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

    const dl = await fetch(url);
    if (!dl.ok) return Response.json({ error: 'Could not download the audio file' }, { status: 502 });
    const bytes = new Uint8Array(await dl.arrayBuffer());

    const payloadHex = payloadFromId(assetId || url);
    const marked = embedMark(bytes, payloadHex);

    const file = new File([marked], 'basemark.wav', { type: 'audio/wav' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    if (asset) {
      await base44.entities.UserAsset.update(assetId, {
        metadata: {
          ...(asset.metadata || {}),
          base_mark: {
            version: BASE_MARK_VERSION,
            payload_hex: payloadHex,
            marked_file_url: file_url,
            embedded_at: new Date().toISOString(),
          },
        },
      });
    }

    return Response.json({ ok: true, payload_hex: payloadHex, marked_file_url: file_url, version: BASE_MARK_VERSION });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});