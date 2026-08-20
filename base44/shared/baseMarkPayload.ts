// BASE Mark — payload derivation. PHASE 1 of the compliance plan.
//
// WHAT THIS REPLACES, AND WHY
// Until now every layer's payload was `payloadFromId()` in baseMark.ts: an
// unkeyed 32-bit FNV-1a hash of the asset id. Three consequences, all of them
// structural rather than cosmetic:
//
//   1. FORGEABLE. FNV-1a is public, asset ids appear in URLs, and the V2 engine
//      (SilentCipher) is MIT-licensed with public weights. Anyone could compute
//      a valid payload for any asset and embed it into arbitrary audio, and the
//      platform would attribute that audio to the named creator. The only thing
//      protecting V1 was the secret chip seed; V2 had no protection at all.
//   2. UNDETECTED COLLISIONS. A 32-bit space gives roughly a 1.2% chance of at
//      least one collision at 10k marked assets and ~50% at ~77k, and nothing
//      checked for one at embed time.
//   3. NO ROTATION PATH. Nothing recorded which key or seed generation a mark
//      was made under, so a compromise had no migration and no audit trail.
//
// The fix is a keyed derivation: payload = first 32 bits of
// HMAC-SHA256(BASE_MARK_PAYLOAD_KEY, asset id). An attacker without the key
// cannot compute the payload for an asset they do not already hold a marked
// copy of, which is what makes the recovered payload non-repudiable
// (BASE_MARK_FORENSIC_SPEC §3) and gives the CMI claim in §5.2 something real
// to stand on.
//
// WHAT THIS DOES NOT FIX — stated plainly, because overclaiming here is the
// exact failure this whole audit was about:
//
//   • REPLAY IS STILL POSSIBLE. Any static message can be re-embedded by
//     someone who can read it. Keying stops an attacker MINTING a mark for an
//     arbitrary asset; it does not stop them copying a mark they already have.
//     No 32/40-bit static payload can, and the honest mitigation is that a
//     replayed mark points at a real registered asset, which is discoverable.
//   • THE 32-BIT SPACE IS UNCHANGED. Keying does not widen it, so collision
//     detection below is required regardless.
//   • THE LEGACY FORMAT MUST STILL BE READ. Existing marked assets carry
//     unkeyed payloads and we do not orphan them (Phase 1.5, dual-read). While
//     legacy acceptance is open, C2 forgery remains reachable for LEGACY-format
//     marks specifically — which is why unpackMessage() reports the format it
//     matched and flags legacy hits as requiring registry corroboration. PHASE 2
//     is what closes that: a legacy hit must resolve to an asset that was itself
//     marked under the legacy format, or it is discarded.

// Format identifiers stamped into asset metadata so a mark's provenance is
// self-describing. Without these, a key rotation or format change has no
// migration path — which was finding C4's second half.
export const PAYLOAD_VERSION_LEGACY = 1; // unkeyed FNV-1a of the asset id
export const PAYLOAD_VERSION_KEYED = 2;  // truncated HMAC-SHA256, this module

// Which generation of BASE_MARK_SEED the spectral chips were built from.
// The chip sequence is global (see audit finding C4), so if the seed is ever
// rotated, previously marked files become undetectable under the new seed.
// Recording the generation at embed time is what makes a future rotation
// survivable at all: a detector can be told which seed to try.
export const SEED_VERSION = 1;

// How many re-derivations to attempt when the derived payload is already taken.
// Each salt is a fresh HMAC, so the chance of exhausting this is negligible;
// the cap exists so a pathological catalogue fails loudly instead of looping.
export const MAX_PAYLOAD_SALT = 8;

// Every index a payload can be recorded under. Kept in one place so a new layer
// cannot be added without the collision check learning about it.
const PAYLOAD_INDEXES = [
  'metadata.base_mark.payload_hex',
  'metadata.base_mark_v2.payload_hex',
  'metadata.base_mark_v4.payload_hex',
];

const enc = new TextEncoder();
let keyPromise = null;

function keyMaterial() {
  const raw = Deno.env.get('BASE_MARK_PAYLOAD_KEY');
  if (!raw) {
    // Deliberately fatal. Falling back to the unkeyed derivation would silently
    // re-open the forgery hole this module exists to close, and a silent
    // downgrade of a forensic guarantee is worse than a failed embed.
    throw new Error('BASE_MARK_PAYLOAD_KEY is not set — refusing to derive an unkeyed payload.');
  }
  return raw;
}

/** True when keyed derivation is available. Read paths use this to decide
 *  whether a keyed check can be attempted at all, so a missing key degrades
 *  detection to legacy-only rather than throwing mid-verification. */
export function isKeyedPayloadConfigured() {
  return !!Deno.env.get('BASE_MARK_PAYLOAD_KEY');
}

async function hmacKey() {
  // The env read happens before assignment, so a missing key throws without
  // poisoning the memoized promise.
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      'raw',
      enc.encode(keyMaterial()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  }
  return await keyPromise;
}

// Domain-separated so the payload derivation and the V2 tag derivation can
// never produce the same bytes for the same input. Without separation, one
// recovered value would leak the other.
async function hmacBytes(domain, message) {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${domain}\u0000${message}`));
  return new Uint8Array(sig);
}

/**
 * Derive the keyed 32-bit payload for an identifier.
 *
 * `salt` is only non-zero when the unsalted derivation collided with an already
 * registered payload — it is stored on the asset so the value stays reproducible.
 */
export async function derivePayload(identifier, salt = 0) {
  const input = salt ? `${identifier}#${salt}` : String(identifier);
  const b = await hmacBytes('basemark.payload.v2', input);
  return (((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0).toString(16).padStart(8, '0');
}

/**
 * Derive the V2 message's 8-bit validity tag.
 *
 * This replaces the hardcoded 0xB5 magic byte. Its purpose is authenticity, not
 * statistical strength: as an 8-bit field it still admits a random decode about
 * 1 time in 256, exactly as the magic byte did. What changes is that the value
 * can no longer be COMPUTED by an attacker, so a V2 mark cannot be minted for an
 * asset without the key. The 1-in-256 false-accept contribution is closed by
 * mandatory registry confirmation in Phase 2, not here — SilentCipher's message
 * is 40 bits and there is no room for a wider tag without a container change.
 */
export async function deriveV2Tag(payloadHex) {
  const b = await hmacBytes('basemark.v2.tag', String(payloadHex).toLowerCase());
  return b[0];
}

/** Every asset already registered under this payload, across all layer indexes. */
export async function payloadOwners(base44, payloadHex) {
  const svc = base44.asServiceRole || base44;
  const pages = await Promise.all(
    PAYLOAD_INDEXES.map((field) =>
      svc.entities.UserAsset.filter({ [field]: payloadHex }, '-created_date', 5).catch(() => []),
    ),
  );
  const seen = new Set();
  const out = [];
  for (const rows of pages) {
    for (const a of rows || []) {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        out.push(a);
      }
    }
  }
  return out;
}

/**
 * Collision-checked keyed derivation for a specific asset.
 *
 * Returns { payload_hex, payload_salt, payload_version }. Re-deriving for the
 * same asset is stable: an existing registration owned by this asset is not
 * treated as a collision, so re-running an embed does not walk the salt.
 */
export async function derivePayloadForAsset(base44, assetId, { maxSalt = MAX_PAYLOAD_SALT } = {}) {
  for (let salt = 0; salt <= maxSalt; salt++) {
    const payloadHex = await derivePayload(assetId, salt);
    const owners = await payloadOwners(base44, payloadHex);
    const foreign = owners.filter((a) => a.id !== assetId);
    if (!foreign.length) {
      return { payload_hex: payloadHex, payload_salt: salt, payload_version: PAYLOAD_VERSION_KEYED };
    }
  }
  // Loud failure. Marking an asset with a payload that already identifies a
  // different one is precisely the confident-wrong-attribution outcome §8
  // exists to prevent, so there is no acceptable fallback here.
  throw new Error(`Could not derive a collision-free payload for asset ${assetId} within ${maxSalt} salts.`);
}

/** Fields stamped alongside a payload so the mark describes its own format. */
export function payloadStamp(derived) {
  return {
    payload_version: derived.payload_version,
    payload_salt: derived.payload_salt || 0,
    seed_version: SEED_VERSION,
  };
}