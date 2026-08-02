// BASE Mark V3 — Phase 2: start the Drift Layer embed for an asset.
//
// WHERE THIS SITS: V3 is the THIRD layer, and it is deliberately chained AFTER
// V2 rather than run in parallel. The drift mark is a low-band delta added on
// top of whatever the file already carries, so it must be applied to the file
// that already carries V1 + V2 — otherwise the V2 finalize step would later
// overwrite the canonical file and erase the drift mark entirely.
//
// This function ONLY starts the prediction. It does not wait, and it does not
// promote anything to canonical. A full-length master takes minutes on a cold
// GPU, well past a request's budget, so finalization (download, integrity
// check, rehost, slot activation) is Phase 3 and runs from a separate poll.
//
// THROUGHPUT IS STILL UNPROVEN at full length — the encode has only been
// measured on bounded 30s clips. maxSeconds is exposed here for exactly that
// reason so operators can keep runs bounded until a full-length benchmark
// exists. Nothing here touches canonical audio.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { startV3, slotHex, BASE_MARK_V3_VERSION, v3Model } from '../../shared/baseMarkV3.ts';
import { allocateSlot, releaseSlot } from '../../shared/baseMarkV3Slots.ts';
import { parseWav } from '../../shared/baseMark.ts';
import { consumeRateLimit, rateLimitResponse } from '../../shared/rateLimit.ts';
import { driftWebhookUrl } from '../../shared/replicateWebhook.ts';

// Record what the master looked like GOING IN, so finalization can prove the
// band-split design actually preserved it. Read from the header only — a ranged
// fetch, not the whole file. Returns nulls for non-WAV sources, in which case
// finalization simply has nothing to compare and skips that guard.
async function sourceFormat(url) {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-8191' } });
    if (!r.ok) return {};
    const w = parseWav(new Uint8Array(await r.arrayBuffer()));
    return w ? { source_sample_rate: w.sampleRate, source_channels: w.channels } : {};
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, maxSeconds = 0, modelVersion, force = false } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId is required' }, { status: 400 });

    const asset = await base44.asServiceRole.entities.UserAsset.get(assetId).catch(() => null);
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

    const isOwner = asset.user_id === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const v2 = asset.metadata?.base_mark_v2 || {};
    const v3 = asset.metadata?.base_mark_v3 || {};

    // Idempotency — never burn a second slot or a second GPU run on an asset
    // that is already marked or already mid-flight.
    if (!force && (v3.status === 'completed' || v3.status === 'embedding')) {
      return Response.json({
        status: v3.status,
        asset_id: asset.id,
        slot_hex: v3.slot_hex,
        prediction_id: v3.prediction_id,
        already_started: true,
      });
    }

    // The drift mark must ride on top of the finished cascade. Marking a
    // pre-V2 file would produce a marked file that V2's own finalize step
    // later replaces, silently discarding the slot we just spent.
    if (v2.status && v2.status !== 'completed') {
      return Response.json({
        error: `Neural (V2) marking is ${v2.status} — the Drift Layer must be applied after it completes.`,
      }, { status: 409 });
    }

    const sourceUrl = v2.marked_file_url || asset.metadata?.wav_url || asset.file_url;
    if (!sourceUrl) return Response.json({ error: 'Asset has no audio file to mark' }, { status: 400 });

    // Quota is checked here rather than at the top of the handler: every early
    // return above is a cheap refusal that starts no GPU, and charging quota
    // for those would let a client burn its hourly budget on no-ops.
    const quota = await consumeRateLimit(base44, 'basemark_v3_embed', user);
    if (!quota.allowed) return rateLimitResponse(quota, 'basemark_v3_embed');

    // Slot first: if the finite pool is exhausted we want to fail before
    // spending GPU time, not after.
    const payloadHex = v2.payload_hex || asset.metadata?.base_mark?.payload_hex || '';
    const alloc = await allocateSlot(base44, asset.id, payloadHex);
    const srcFormat = await sourceFormat(sourceUrl);

    let pred;
    try {
      // Webhook finalizes the run the moment it settles; pollBaseMarkV3 stays
      // as the safety net (and the only path when the webhook env is unset).
      pred = await startV3({
        audio: sourceUrl,
        mode: 'encode',
        slot_hex: slotHex(alloc.slot),
        max_seconds: Number(maxSeconds) || 0,
      }, modelVersion, driftWebhookUrl(asset.id));
    } catch (err) {
      // Hand the slot straight back — a slot reserved against a run that never
      // started is dead inventory in a pool of only 65,536.
      await releaseSlot(base44, alloc.record.id, `Embed failed to start: ${err.message}`).catch(() => {});
      return Response.json({ error: `Drift Layer could not be started: ${err.message}` }, { status: 502 });
    }

    await base44.asServiceRole.entities.UserAsset.update(asset.id, {
      metadata: {
        ...(asset.metadata || {}),
        base_mark_v3: {
          version: BASE_MARK_V3_VERSION,
          engine: 'drift',
          model: v3Model(),
          status: 'embedding',
          prediction_id: pred.id,
          slot: alloc.slot,
          slot_hex: alloc.hex,
          slot_record_id: alloc.record.id,
          payload_hex: payloadHex,
          source_file_url: sourceUrl,
          ...srcFormat,
          max_seconds: Number(maxSeconds) || 0,
          started_at: new Date().toISOString(),
        },
      },
    });

    return Response.json({
      status: 'embedding',
      asset_id: asset.id,
      prediction_id: pred.id,
      slot: alloc.slot,
      slot_hex: alloc.hex,
      reused_slot: alloc.reused,
      source_file_url: sourceUrl,
      note: 'Prediction started. Poll for completion — the master is untouched until finalization.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});