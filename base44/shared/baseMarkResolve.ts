// BASE Mark — payload resolution and attribution gate. PHASE 2.
//
// WHAT THIS REPLACES
// Four separate call sites each did their own "payload -> registry rows" lookup
// (baseMarkVerify.registryMatches, lookupBaseMark, detectBaseMarkV2,
// baseMarkV4Gate.resolveV4Payload). They disagreed in ways that mattered:
// some returned up to five rows as equals, one silently took rows[0], and none
// of them treated "resolves to nothing" as a reason to withhold attribution.
// This module is the single answer, for the same reason baseMarkVerify.ts became
// the single detection funnel.
//
// THE THREE RULES PHASE 2 ADDS
//
//   1. REGISTRY CONFIRMATION IS MANDATORY. A recovered payload that matches no
//      registered asset is a false positive and must be discarded, never
//      reported as an attribution (BASE_MARK_FORENSIC_SPEC §8). This is also
//      what closes the residual false-accept rate of the V2 validity byte: an
//      8-bit tag admits a random decode roughly 1 time in 256 and no keying can
//      change that, but a random 32-bit payload almost never lands on a
//      registered asset. Detection and attribution are therefore separate
//      outcomes, and this module only ever grants the second.
//
//   2. A COLLISION MUST ABSTAIN. If two or more DIFFERENT assets are registered
//      under one payload, the payload does not identify either of them. Taking
//      the newest row would manufacture a confident wrong attribution — the
//      precise failure §8 exists to prevent. Phase 1 made new collisions
//      practically impossible by checking at embed time, but the pre-Phase-1
//      catalogue was never checked, so this case is real for legacy rows and is
//      reported as `ambiguous_payload_collision` rather than resolved.
//
//   3. A LEGACY-FORMAT HIT MUST BE CORROBORATED BY THE REGISTRY. This is the
//      half of finding C2 that Phase 1 explicitly left open. A legacy V2 message
//      (unkeyed FNV payload + the published 0xB5 magic byte) is still
//      constructible by anyone, so accepting one on its own would leave forgery
//      reachable. The check: the asset the payload resolves to must ITSELF have
//      been marked under the legacy format. If that asset's mark is keyed, then
//      our encoder could not have produced a legacy message naming it, so the
//      message is a forgery or a stale re-embed — either way not attributable.
//
// WHAT THIS STILL DOES NOT FIX, stated plainly:
//   • REPLAY. A mark copied out of a genuinely registered file resolves
//     correctly, because it IS the real payload. No resolution rule can catch
//     that; it needs per-copy payloads, which 32 bits cannot carry.

import { payloadOwners, PAYLOAD_VERSION_LEGACY, PAYLOAD_VERSION_KEYED } from './baseMarkPayload.ts';

export const RESOLVE_ATTRIBUTED = 'attributed';
export const RESOLVE_NOT_DETECTED = 'not_detected';
export const RESOLVE_NO_PAYLOAD = 'no_payload';
export const RESOLVE_UNREGISTERED = 'payload_not_in_registry';
export const RESOLVE_AMBIGUOUS = 'ambiguous_payload_collision';
export const RESOLVE_LEGACY_UNCORROBORATED = 'legacy_format_not_corroborated';

// Every layer a payload can be recorded under, with the metadata key that holds
// its format stamp. Mirrors PAYLOAD_INDEXES in baseMarkPayload.ts.
const LAYER_KEYS = ['base_mark', 'base_mark_v2', 'base_mark_v4'];

/**
 * Which payload formats this asset was actually marked under for a given
 * payload. An asset marked before Phase 1 carries no `payload_version` field at
 * all, and absence means LEGACY — treating an unstamped mark as keyed would
 * assert a guarantee that was never made.
 */
export function registeredPayloadVersions(asset, payloadHex) {
  const hex = String(payloadHex || '').toLowerCase();
  const out = [];
  for (const key of LAYER_KEYS) {
    const layer = asset?.metadata?.[key];
    if (layer && String(layer.payload_hex || '').toLowerCase() === hex) {
      out.push({ layer: key, payload_version: layer.payload_version || PAYLOAD_VERSION_LEGACY });
    }
  }
  return out;
}

/** Public, non-sensitive projection of a registry row. Never exposes telemetry. */
export function publicMatch(asset) {
  return {
    id: asset.id,
    title: asset.title,
    asset_type: asset.asset_type,
    created_date: asset.created_date,
    marked_at:
      asset.metadata?.base_mark_v2?.embedded_at ||
      asset.metadata?.base_mark?.embedded_at ||
      null,
  };
}

/**
 * Resolve a recovered payload to exactly one registered asset, or refuse.
 *
 * `detection` is the funnel result (or any object carrying payload_hex plus the
 * optional payload_version / requires_registry_corroboration flags produced by
 * unpackMessage). Returns a uniform verdict; `attributed` is true ONLY when a
 * single asset owns the payload and the format check passes.
 */
export async function resolvePayload(base44, detection = {}) {
  const payloadHex = String(detection.payload_hex || '').toLowerCase();
  const base = { attributed: false, asset: null, asset_id: null, title: null, owner_count: 0, matches: [] };

  if (!/^[0-9a-f]{8}$/.test(payloadHex)) {
    return { ...base, status: RESOLVE_NO_PAYLOAD };
  }

  const owners = await payloadOwners(base44, payloadHex);
  if (!owners.length) {
    return { ...base, status: RESOLVE_UNREGISTERED };
  }
  if (owners.length > 1) {
    // Deliberately reports the COUNT and nothing else. Naming the candidates
    // would invite a human to pick one, which is the same wrong attribution the
    // abstention exists to prevent.
    return { ...base, status: RESOLVE_AMBIGUOUS, owner_count: owners.length };
  }

  const asset = owners[0];
  const registered = registeredPayloadVersions(asset, payloadHex);

  // Rule 3. Only applies to a detection that arrived in the legacy message
  // format — a keyed hit is already unforgeable, and a V1 spectral hit carries
  // no format at all (its protection is the secret chip seed, not the payload).
  if (detection.requires_registry_corroboration) {
    const hasLegacyMark = registered.some((r) => r.payload_version === PAYLOAD_VERSION_LEGACY);
    if (!hasLegacyMark) {
      return {
        ...base,
        status: RESOLVE_LEGACY_UNCORROBORATED,
        owner_count: 1,
        // No asset is returned. The whole point is that this hit must not be
        // attached to the asset it names.
      };
    }
  }

  return {
    status: RESOLVE_ATTRIBUTED,
    attributed: true,
    asset,
    asset_id: asset.id,
    title: asset.title,
    owner_count: 1,
    registered_payload_versions: registered,
    matches: [publicMatch(asset)],
  };
}

/**
 * Detection + resolution in one step, for callers holding a funnel result.
 * A miss short-circuits without touching the registry.
 */
export async function confirmDetection(base44, result) {
  if (!result?.detected) {
    return { status: RESOLVE_NOT_DETECTED, attributed: false, asset: null, asset_id: null, matches: [] };
  }
  return await resolvePayload(base44, result);
}

/** Human-readable, creator-safe explanation of a non-attributed verdict. */
export function resolveExplanation(status) {
  switch (status) {
    case RESOLVE_ATTRIBUTED:
      return 'This payload resolves to one registered work.';
    case RESOLVE_UNREGISTERED:
      return 'A signature was recovered but it matches no registered work, so no attribution can be made.';
    case RESOLVE_AMBIGUOUS:
      return 'More than one registered work shares this payload, so it cannot identify either of them.';
    case RESOLVE_LEGACY_UNCORROBORATED:
      return 'The signature arrived in a superseded format that the named work was not marked under, so it is not accepted as proof.';
    case RESOLVE_NO_PAYLOAD:
      return 'No payload was recovered.';
    default:
      return 'No BASE Mark was recovered.';
  }
}