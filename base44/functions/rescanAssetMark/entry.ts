import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { detectMark } from '../../shared/baseMark.ts';
import { startV2, BASE_MARK_V2_VERSION } from '../../shared/baseMarkV2.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';
import { evaluateRescan } from '../../shared/rescanFinalize.ts';

// Fire-and-return forensic re-scan of a registered asset.
//
// V1 (acoustic) runs in-memory immediately — it is fast. V2 (neural) is
// dispatched to Replicate WITHOUT blocking: a cold T4 can take several
// minutes (the same reason embedBaseMarkV2 is split into fire + poll), and
// blocking on it would blow the function timeout. The pending V2 prediction
// id and the V1 result are stamped on the asset's metadata so the frontend can
// poll `pollRescanAssetMark` (passing assetId) until status='completed'.
//
// For assets with NO V2 mark, there is nothing to wait on — the V1 result is
// evaluated immediately and status='completed' is returned without polling.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId is required' }, { status: 400 });

    const asset = await base44.entities.UserAsset.get(assetId);
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

    const v2Reg = asset.metadata?.base_mark_v2?.payload_hex || null;
    const v1Reg = asset.metadata?.base_mark?.payload_hex || null;
    if (!v2Reg && !v1Reg) {
      return Response.json({ registered: false, flag_created: false, message: 'No registered BASE Mark on this asset' });
    }

    const rawUrl = asset.metadata?.base_mark_v2?.original_file_url || asset.metadata?.wav_url || asset.file_url;
    let safeUrl;
    try { safeUrl = assertSafeUrl(rawUrl); } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    const scanUrl = safeUrl.toString();

    // --- V1 acoustic re-scan (in-memory, immediate) ---
    let v1Result = null;
    if (v1Reg) {
      try {
        const dl = await fetch(scanUrl);
        if (!dl.ok) {
          v1Result = { detected: false, payload_hex: null, match: false, inconclusive: true, error: 'download failed' };
        } else {
          const bytes = new Uint8Array(await dl.arrayBuffer());
          const v1 = detectMark(bytes);
          v1Result = { detected: v1.detected, payload_hex: v1.payload_hex || null, match: v1.detected && v1.payload_hex === v1Reg };
        }
      } catch (e) {
        // Non-WAV / RIFF parse failure = inconclusive, NOT a tamper signal.
        v1Result = { detected: false, payload_hex: null, match: false, inconclusive: true, error: e.message };
      }
    }

    // --- V2 neural re-scan (fire, don't block) ---
    let v2PredictionId = null;
    let v2DispatchError = null;
    if (v2Reg) {
      try {
        const pred = await startV2({ action: 'decode', audio: scanUrl });
        v2PredictionId = pred.id;
      } catch (e) {
        v2DispatchError = e.message;
      }
    }

    // If there is no V2 to wait on, evaluate immediately from V1 alone (a V2
    // dispatch failure is treated as inconclusive so we never false-flag on a
    // transient Replicate outage).
    let status = 'processing';
    let immediate = null;
    const noV2Pending = !v2Reg || v2PredictionId === null;
    if (noV2Pending) {
      const v2Result = (v2Reg && !v2PredictionId)
        ? { detected: false, payload_hex: null, match: false, error: v2DispatchError || 'dispatch failed' }
        : null;
      immediate = await evaluateRescan(base44, asset, { v1: v1Result, v2: v2Result });
      status = 'completed';
    }

    // Persist pending rescan state so poll can complete it.
    const rescanMeta = {
      status,
      v2_prediction_id: v2PredictionId,
      v1_result: v1Result,
      ...(v2DispatchError ? { v2_dispatch_error: v2DispatchError } : {}),
      started_at: new Date().toISOString(),
    };
    await base44.entities.UserAsset.update(assetId, {
      metadata: { ...(asset.metadata || {}), rescan: rescanMeta },
    });

    return Response.json({
      registered: true,
      v2_registered: !!v2Reg,
      v1_registered: !!v1Reg,
      status,
      v1_result: v1Result,
      v2_prediction_id: v2PredictionId,
      version: BASE_MARK_V2_VERSION,
      ...(immediate ? { ...immediate, results: { v1: v1Result, v2: null } } : {}),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});