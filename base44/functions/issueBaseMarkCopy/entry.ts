import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';
import { startV4, getV4Prediction, packV4Message, newCopyId, v4Key, v4Version, BASE_MARK_V4_VERSION } from '../../shared/baseMarkV4.ts';
import { V4_MESSAGE_VERSION } from '../../shared/baseMarkV4Message.ts';
import { derivePayloadForAsset } from '../../shared/baseMarkPayload.ts';
import { selectMarkingSource } from '../../shared/baseMarkSourceGuard.ts';
import { V4_PRODUCTION_APPROVED } from '../../shared/baseMarkV4Gate.ts';

// Issue a per-copy marked file. PHASE 6.
//
// This is the only reason per-copy payloads exist: cutting a DIFFERENT file for
// each recipient, each carrying a distinct copy id, so audio recovered later
// names the copy it leaked from rather than only the work. Without an issuance
// path the format change is inert.
//
// ADMIN ONLY, and it stays that way while V4 is unpromoted. Two independent
// reasons: it burns Replicate CPU on the production watermark key, and a copy
// issued while the acceptance gate is uncalibrated could be presented as
// forensic evidence it cannot yet support. The response says so explicitly
// rather than leaving the caller to remember.
//
// Split into issue/poll because an encode on a full master exceeds one request.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'issue';

    if (action === 'issue') {
      const assetId = String(body.asset_id || '');
      if (!assetId) return Response.json({ error: 'asset_id is required' }, { status: 400 });
      const issuedTo = String(body.issued_to || '').trim();
      if (!issuedTo) {
        // A copy with no recorded recipient is untraceable by construction, so
        // there is no point cutting one.
        return Response.json({ error: 'issued_to is required — an unattributed copy cannot be traced' }, { status: 400 });
      }

      const asset = await base44.asServiceRole.entities.UserAsset.get(assetId).catch(() => null);
      if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

      // Same guard as the other marking paths: never cut a copy from one of our
      // own marked outputs, which would stack signatures and destroy both.
      const picked = selectMarkingSource(asset);
      if (!picked.url) {
        return Response.json({ error: 'No unmarked master available to cut a copy from', reason: picked.reason }, { status: 409 });
      }

      // The asset payload is the SAME keyed value V1/V2 carry, so the copy
      // resolves through the one shared attribution gate. Only the copy id
      // differs between copies.
      const derived = await derivePayloadForAsset(base44, assetId);
      const copyId = newCopyId();
      const messageHex = await packV4Message(derived.payload_hex, copyId);

      const pred = await startV4({
        audio: picked.url,
        mode: 'encode',
        payload_hex: messageHex,
        key_hex: v4Key(),
      }, v4Version());

      const record = await base44.asServiceRole.entities.BaseMarkCopy.create({
        asset_id: assetId,
        user_id: asset.user_id,
        payload_hex: derived.payload_hex,
        copy_id: copyId,
        message_hex: messageHex,
        message_version: V4_MESSAGE_VERSION,
        issued_to: issuedTo,
        purpose: body.purpose || '',
        status: 'processing',
        notes: body.notes || '',
      });

      return Response.json({
        ok: true,
        copy_record_id: record.id,
        copy_id: copyId,
        payload_hex: derived.payload_hex,
        prediction_id: pred.id,
        source_url: picked.url,
        layer_version: BASE_MARK_V4_VERSION,
        production_approved: V4_PRODUCTION_APPROVED,
        note: 'Poll with action:"poll" and this prediction_id plus copy_record_id. The Speed Layer is not production-approved: this copy is traceable but its recovery cannot yet back a creator-facing attribution.',
      });
    }

    if (action === 'poll') {
      const { prediction_id, copy_record_id } = body;
      if (!prediction_id || !copy_record_id) {
        return Response.json({ error: 'prediction_id and copy_record_id are required' }, { status: 400 });
      }
      const p = await getV4Prediction(prediction_id);
      if (p.status === 'starting' || p.status === 'processing') {
        return Response.json({ status: p.status });
      }
      if (p.status !== 'succeeded' || !p.output?.audio) {
        await base44.asServiceRole.entities.BaseMarkCopy.update(copy_record_id, {
          status: 'failed',
          notes: `Encode failed: ${p.error || p.status}`,
        });
        return Response.json({ status: p.status, error: p.error || 'no audio returned' });
      }

      // Cog returns small outputs as a data: URI, which is not a durable
      // delivery URL — rehost before recording it as the issued file.
      const dl = await fetch(p.output.audio);
      if (!dl.ok) return Response.json({ error: 'Could not read the marked output' }, { status: 502 });
      const bytes = new Uint8Array(await dl.arrayBuffer());
      const file = new File([bytes], `basemark-copy-${body.copy_id || 'v4'}.wav`, { type: 'audio/wav' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const record = await base44.asServiceRole.entities.BaseMarkCopy.update(copy_record_id, {
        status: 'issued',
        marked_file_url: file_url,
      });

      return Response.json({ status: 'succeeded', marked_file_url: file_url, copy: record });
    }

    return Response.json({ error: 'action must be issue or poll' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}