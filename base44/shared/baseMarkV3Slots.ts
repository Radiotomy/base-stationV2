// BASE Mark V3 — slot allocation.
//
// WHY THIS EXISTS: WavMark's 32-bit capacity is 16 sync bits + 16 usable bits,
// so the Drift Layer cannot carry the 32-bit registry payload that V1 and V2
// carry. It carries a 16-bit POINTER instead, and something has to own the
// mapping from pointer to asset. That is this module plus the BaseMarkV3Slot
// entity. baseMarkV3.ts deliberately refused to invent an allocation strategy;
// this is that strategy, kept separate so the transport layer stays dumb.
//
// HARD CEILING: 65,536 concurrent allocations. That is a property of WavMark,
// not of our code, and no amount of engineering here raises it. Two consequences
// worth stating plainly before anyone plans a catalog-scale rollout:
//
//   1. V3 should be applied to high-value masters, not to every asset. At
//      current generation rates the pool is exhaustible.
//   2. Recycling a slot is NOT free. A released slot may still be embedded in
//      files already distributed in the wild, so reusing it immediately would
//      attribute an old file to a new asset — a false positive, which is the
//      one failure mode a forensic system must never have. Hence the quarantine
//      below: released slots are only reusable after they have sat idle long
//      enough that a stale recovery is implausible.
//
// CONCURRENCY: Base44 entities have no transactions or unique constraints, so
// "pick the next free slot" is inherently racy. Rather than pretend otherwise,
// allocation writes optimistically and then VERIFIES it won the race, yielding
// to the earliest-created record on a tie and retrying. Duplicate slots are the
// one corruption this registry cannot tolerate.

import { slotHex } from './baseMarkV3.ts';

export const V3_SLOT_CEILING = 0xffff; // 65,535 — inclusive max

// A released slot is only recycled after this long. Deliberately conservative:
// the cost of waiting is a slightly smaller pool, the cost of recycling too
// early is misattributing a file to the wrong creator.
export const SLOT_QUARANTINE_DAYS = 180;

const MAX_ALLOCATION_ATTEMPTS = 5;

/** Existing allocation for an asset, or null. */
export async function findSlotForAsset(base44, assetId) {
  const rows = await base44.asServiceRole.entities.BaseMarkV3Slot.filter(
    { asset_id: assetId },
    '-created_date',
    5,
  );
  return rows?.find((r) => r.status !== 'released') || null;
}

/** Reverse lookup — what the decoder gives us is a slot_hex. */
export async function findAssetForSlotHex(base44, hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]{4}$/i.test(hex)) return null;
  const rows = await base44.asServiceRole.entities.BaseMarkV3Slot.filter(
    { slot_hex: hex.toLowerCase() },
    '-created_date',
    5,
  );
  // An active allocation always wins over a released one carrying the same
  // number — that is exactly the stale-recovery case quarantine protects.
  return rows?.find((r) => r.status === 'active') || rows?.find((r) => r.status === 'reserved') || null;
}

/** Highest slot ever handed out, or -1 when the pool is untouched. */
async function highestSlot(base44) {
  const rows = await base44.asServiceRole.entities.BaseMarkV3Slot.list('-slot', 1);
  const top = rows?.[0]?.slot;
  return Number.isInteger(top) ? top : -1;
}

/** Oldest quarantine-expired released slot, or null. */
async function recyclableSlot(base44) {
  const cutoff = new Date(Date.now() - SLOT_QUARANTINE_DAYS * 86400000).toISOString();
  const rows = await base44.asServiceRole.entities.BaseMarkV3Slot.filter(
    { status: 'released', released_at: { $lte: cutoff } },
    'released_at',
    1,
  );
  return rows?.[0] || null;
}

/**
 * Allocate a slot for an asset.
 *
 * Idempotent: an asset that already holds a slot gets the same one back, so a
 * retried embed never burns a second slot from a finite pool.
 *
 * Throws when the pool is genuinely exhausted — silently wrapping around or
 * reusing a live slot would corrupt attribution, which is worse than failing.
 */
export async function allocateSlot(base44, assetId, payloadHex) {
  if (!assetId) throw new Error('assetId is required to allocate a V3 slot');

  const existing = await findSlotForAsset(base44, assetId);
  if (existing) return { record: existing, slot: existing.slot, hex: existing.slot_hex, reused: true };

  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt++) {
    // Prefer recycling a long-dead slot over growing into fresh pool space —
    // it keeps the high-water mark down and the pool is not renewable.
    const recycled = await recyclableSlot(base44);
    let slot;
    let recycledId = null;

    if (recycled) {
      slot = recycled.slot;
      recycledId = recycled.id;
    } else {
      const next = (await highestSlot(base44)) + 1;
      if (next > V3_SLOT_CEILING) {
        throw new Error(
          `BASE Mark V3 slot pool exhausted (${V3_SLOT_CEILING + 1} slots, all active or in quarantine). ` +
          'The Drift Layer cannot be applied to further assets until slots are released.',
        );
      }
      slot = next;
    }

    const hex = slotHex(slot);

    if (recycledId) {
      // Reclaim in place so the number cannot be handed out twice.
      await base44.asServiceRole.entities.BaseMarkV3Slot.update(recycledId, {
        asset_id: assetId,
        payload_hex: payloadHex || '',
        status: 'reserved',
        released_at: null,
        notes: `Recycled after ${SLOT_QUARANTINE_DAYS}d quarantine`,
      });
    } else {
      await base44.asServiceRole.entities.BaseMarkV3Slot.create({
        slot,
        slot_hex: hex,
        asset_id: assetId,
        payload_hex: payloadHex || '',
        status: 'reserved',
      });
    }

    // Did we actually win the number? Two writers can pick the same free slot
    // in the gap between read and create. The earliest-created record wins;
    // the loser stands down and tries again rather than leaving a duplicate.
    const holders = await base44.asServiceRole.entities.BaseMarkV3Slot.filter(
      { slot_hex: hex },
      'created_date',
      10,
    );
    const live = (holders || []).filter((r) => r.status !== 'released');
    const winner = live[0];

    if (winner && winner.asset_id === assetId) {
      // Clean up any duplicate rows we or a racing writer left behind.
      for (const dup of live.slice(1)) {
        await base44.asServiceRole.entities.BaseMarkV3Slot.delete(dup.id).catch(() => {});
      }
      return { record: winner, slot, hex, reused: !!recycledId };
    }

    // Lost the race — drop our row and pick a different number.
    const ours = live.find((r) => r.asset_id === assetId);
    if (ours) await base44.asServiceRole.entities.BaseMarkV3Slot.delete(ours.id).catch(() => {});
  }

  throw new Error('Could not allocate a V3 slot after repeated contention — try again.');
}

/** Mark the slot live once a marked file actually carries it. */
export async function activateSlot(base44, slotRecordId) {
  return await base44.asServiceRole.entities.BaseMarkV3Slot.update(slotRecordId, { status: 'active' });
}

/**
 * Return a slot to the pool. It stays unusable for SLOT_QUARANTINE_DAYS —
 * see the note at the top about files already in the wild.
 */
export async function releaseSlot(base44, slotRecordId, notes) {
  return await base44.asServiceRole.entities.BaseMarkV3Slot.update(slotRecordId, {
    status: 'released',
    released_at: new Date().toISOString(),
    ...(notes ? { notes } : {}),
  });
}

/** Pool health — for the admin view and for refusing rollout before exhaustion. */
export async function poolStats(base44) {
  const [active, reserved, released] = await Promise.all([
    base44.asServiceRole.entities.BaseMarkV3Slot.filter({ status: 'active' }, '-created_date', 1000),
    base44.asServiceRole.entities.BaseMarkV3Slot.filter({ status: 'reserved' }, '-created_date', 1000),
    base44.asServiceRole.entities.BaseMarkV3Slot.filter({ status: 'released' }, '-created_date', 1000),
  ]);
  const high = await highestSlot(base44);
  const used = (active?.length || 0) + (reserved?.length || 0);
  return {
    ceiling: V3_SLOT_CEILING + 1,
    active: active?.length || 0,
    reserved: reserved?.length || 0,
    released: released?.length || 0,
    high_water_mark: high,
    remaining: V3_SLOT_CEILING + 1 - used,
    pct_used: Math.round((used / (V3_SLOT_CEILING + 1)) * 10000) / 100,
    quarantine_days: SLOT_QUARANTINE_DAYS,
  };
}