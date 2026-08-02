import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  allocateSlot,
  activateSlot,
  releaseSlot,
  findSlotForAsset,
  findAssetForSlotHex,
  poolStats,
} from '../../shared/baseMarkV3Slots.ts';

// Admin surface for the BASE Mark V3 slot registry.
//
// The Drift Layer's 16-bit pointer comes from a finite, non-renewable pool of
// 65,536. This endpoint is how that pool is inspected and operated before the
// embed stage is allowed to consume from it — deciding rollout scope without
// knowing how many slots remain is how you exhaust it by accident.
//
// Actions:
//   stats                      — pool health (use this before any rollout)
//   allocate { assetId, payloadHex } — idempotent; same asset always gets same slot
//   activate { slotRecordId }  — call once a marked file actually carries the slot
//   release  { slotRecordId }  — return to pool (enters quarantine, not reusable yet)
//   lookup   { assetId } | { slotHex } — both directions of the pointer mapping
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { action = 'stats', assetId, payloadHex, slotRecordId, slotHex: hex, notes } = await req.json();

    switch (action) {
      case 'stats':
        return Response.json({ ok: true, pool: await poolStats(base44) });

      case 'allocate': {
        if (!assetId) return Response.json({ error: 'assetId is required' }, { status: 400 });
        const res = await allocateSlot(base44, assetId, payloadHex);
        return Response.json({
          ok: true,
          slot: res.slot,
          slot_hex: res.hex,
          slot_record_id: res.record.id,
          reused_existing: res.reused,
          status: res.record.status,
        });
      }

      case 'activate': {
        if (!slotRecordId) return Response.json({ error: 'slotRecordId is required' }, { status: 400 });
        const rec = await activateSlot(base44, slotRecordId);
        return Response.json({ ok: true, slot: rec.slot, slot_hex: rec.slot_hex, status: rec.status });
      }

      case 'release': {
        if (!slotRecordId) return Response.json({ error: 'slotRecordId is required' }, { status: 400 });
        const rec = await releaseSlot(base44, slotRecordId, notes);
        return Response.json({
          ok: true,
          slot: rec.slot,
          status: rec.status,
          released_at: rec.released_at,
          note: 'Slot is in quarantine and will not be recycled until it expires — files already distributed may still carry it.',
        });
      }

      case 'lookup': {
        if (assetId) {
          const rec = await findSlotForAsset(base44, assetId);
          return Response.json({ ok: true, found: !!rec, record: rec || null });
        }
        if (hex) {
          const rec = await findAssetForSlotHex(base44, hex);
          return Response.json({ ok: true, found: !!rec, record: rec || null });
        }
        return Response.json({ error: 'lookup needs assetId or slotHex' }, { status: 400 });
      }

      default:
        return Response.json({ error: `Unknown action '${action}'` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});