// TRADE SECRET — BASE Station proprietary and confidential. Server-side only.
// Do not copy, publish, redistribute or import into client code.
// BASE Mark V4 message format — PHASE 6. Per-copy payloads.
//
// WHAT THIS CLOSES
// Every earlier phase hardened MINTING: keyed derivation (Phase 1) means an
// attacker cannot compute a payload for an asset they do not hold, and the
// attribution gate (Phase 2/5) means a recovered payload must resolve to exactly
// one registered asset. None of that touches REPLAY — a mark lifted out of a
// genuinely registered file is a real payload with a real tag naming a real
// asset, so it resolves correctly no matter how strict the gate is. Per
// FORENSIC_SPEC §8.2 the only answer is a payload that is unique PER COPY, and
// 32 bits cannot carry one alongside the asset identifier. audiowmark's 128-bit
// message can, which is why this lands on V4 and could not land on V1/V2.
//
// THE LAYOUT (128 bits / 32 hex chars)
//   [ 0.. 7]  asset payload  — the SAME keyed 32-bit payload V1/V2 carry, so a
//                              V4 recovery resolves through the one shared
//                              attribution gate rather than a parallel index.
//   [ 8..15]  copy id        — 32 bits identifying the issued copy. All-zero
//                              means "no per-copy issuance" (a bearer copy),
//                              which is a weaker claim and is reported as such.
//   [16..31]  validity tag   — 64-bit truncated HMAC over payload AND copy id.
//
// WHAT THIS REPLACES
// The previous format left-aligned the payload and zero-filled the remaining 96
// bits, using the zero tail as a structural check. That was always a heuristic,
// not authentication: it says only "a spurious decode is unlikely to produce 96
// zeros", and it is trivially reproducible by anyone. Upstream's documented
// recommendation is that the message be an HMAC, and there were ZERO V4-marked
// assets in the catalogue when this landed, so the old format is rejected
// outright rather than dual-read — the same discipline Phase 3 applied to legacy
// V2 messages.
//
// WHAT THIS STILL DOES NOT DO, stated plainly:
//   • It does not stop a copy being redistributed. It makes redistribution
//     ATTRIBUTABLE to the copy it came from, which is the entire point — the
//     mark stops being "belongs to asset X" and becomes "is the copy issued to
//     recipient Y".
//   • It buys V1 and V2 nothing. Their message widths are fixed, so a replayed
//     V1/V2 mark remains indistinguishable from a genuine one, and §8.2's
//     narrower claim continues to apply to them.

import { deriveV4Tag } from './baseMarkPayload.ts';

export const V4_MESSAGE_HEX_CHARS = 32;
export const V4_MESSAGE_VERSION = 2; // 1 = retired zero-tail format
export const V4_BEARER_COPY_ID = '00000000';

/** A fresh random 32-bit copy id. Random, not sequential: a sequential id would
 *  leak issuance volume and let a recipient guess neighbouring copies. */
export function newCopyId() {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  const hex = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  // Never hand back the bearer sentinel by chance — it would silently downgrade
  // a per-copy issuance to an untraceable one.
  return hex === V4_BEARER_COPY_ID ? '00000001' : hex;
}

/**
 * Build the 128-bit message for an asset payload and (optionally) a copy id.
 *
 * Async because the tag is a real HMAC. Callers that used the old synchronous
 * helper must await this — deliberately a compile-visible change rather than a
 * silent format switch.
 */
export async function packV4Message(payloadHex, copyIdHex = V4_BEARER_COPY_ID) {
  const p = String(payloadHex || '').trim().toLowerCase();
  const c = String(copyIdHex || V4_BEARER_COPY_ID).trim().toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(p)) throw new Error('V4 expects a 32-bit asset payload as 8 hex chars');
  if (!/^[0-9a-f]{8}$/.test(c)) throw new Error('V4 expects a 32-bit copy id as 8 hex chars');
  const tag = await deriveV4Tag(p, c);
  return `${p}${c}${tag}`;
}

/**
 * Read a recovered message.
 *
 * `valid` is now a CRYPTOGRAPHIC verdict, not a structural one: a message whose
 * tag does not match its own payload and copy id does not unpack, so a forged or
 * tampered message fails here rather than being carried inward as a
 * flagged-but-valid hit (the same rule the V2 layer adopted in Phase 1).
 */
export async function unpackV4Message(messageHex) {
  const m = String(messageHex || '').trim().toLowerCase();
  const miss = { valid: false, payload_hex: null, copy_id: null, per_copy: false, reason: null };
  if (!/^[0-9a-f]{32}$/.test(m)) return { ...miss, reason: 'malformed_message' };

  const payload_hex = m.slice(0, 8);
  const copy_id = m.slice(8, 16);
  const tag = m.slice(16);

  // The retired format is recognisable and is refused by name, so a stale
  // container or an old marked file produces a clear answer rather than a
  // mysterious tag failure.
  if (/^0+$/.test(m.slice(8))) {
    return { ...miss, payload_hex, reason: 'retired_zero_tail_format' };
  }

  const expected = await deriveV4Tag(payload_hex, copy_id);
  if (tag !== expected) return { ...miss, payload_hex, copy_id, reason: 'tag_mismatch' };

  return {
    valid: true,
    payload_hex,
    copy_id,
    per_copy: copy_id !== V4_BEARER_COPY_ID,
    message_version: V4_MESSAGE_VERSION,
    reason: null,
  };
}