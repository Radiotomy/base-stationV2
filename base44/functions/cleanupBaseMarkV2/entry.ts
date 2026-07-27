import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { finalizeV2Prediction } from '../../shared/baseMarkV2Finalize.ts';

// Admin maintenance: clears stranded BASE Mark V2 Replicate jobs.
//   1. Cancel every in-flight Replicate prediction (starting/processing) —
//      covers abandoned decode scans AND stuck embed predictions alike.
//   2. Back-fill every UserAsset left at base_mark_v2.status = "processing":
//      fetch its prediction; if settled (or just canceled in step 1), run the
//      shared finalize so the asset moves to a terminal completed/failed state
//      and (on success) the watermarked WAV gets rehosted into the registry.
// Admin-only: touches all assets + mutates external Replicate state.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const token = Deno.env.get('REPLICATE_API_TOKEN');
    if (!token) return Response.json({ error: 'REPLICATE_API_TOKEN is not set' }, { status: 500 });
    const headers = { 'Authorization': `Bearer ${token}` };

    const report = { canceled: [], finalized: [], still_processing: [], errors: [] };

    // --- 1. Cancel every in-flight prediction on the most recent page ---
    const list = await fetch('https://api.replicate.com/v1/predictions', { headers });
    const listData = list.ok ? await list.json() : { results: [] };
    for (const p of listData.results || []) {
      if (p.status === 'starting' || p.status === 'processing') {
        const c = await fetch(`https://api.replicate.com/v1/predictions/${p.id}/cancel`, { method: 'POST', headers });
        report.canceled.push({ id: p.id, ok: c.ok, status: c.ok ? 'canceled' : 'cancel_failed' });
      }
    }

    // --- 2. Back-fill stale "processing" embed assets ---
    const assets = await base44.asServiceRole.entities.UserAsset.filter(
      { 'metadata.base_mark_v2.status': 'processing' },
      '-created_date',
      200,
    );
    for (const asset of assets || []) {
      const pid = asset.metadata?.base_mark_v2?.prediction_id;
      if (!pid) {
        await base44.asServiceRole.entities.UserAsset.update(asset.id, {
          metadata: { ...(asset.metadata || {}), base_mark_v2: { ...(asset.metadata?.base_mark_v2 || {}), status: 'failed', error: 'no prediction id' } },
        });
        report.errors.push({ asset_id: asset.id, error: 'no prediction id' });
        continue;
      }
      const pr = await fetch(`https://api.replicate.com/v1/predictions/${pid}`, { headers });
      if (!pr.ok) {
        report.errors.push({ asset_id: asset.id, prediction_id: pid, error: `poll ${pr.status}` });
        continue;
      }
      const pred = await pr.json();
      if (pred.status === 'starting' || pred.status === 'processing') {
        report.still_processing.push({ asset_id: asset.id, prediction_id: pid });
        continue;
      }
      const f = await finalizeV2Prediction(base44.asServiceRole, pred);
      report.finalized.push({ asset_id: asset.id, prediction_id: pid, status: f.status });
    }

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});