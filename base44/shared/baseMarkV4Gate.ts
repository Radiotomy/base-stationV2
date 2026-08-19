// BASE Mark V4 (Speed Layer) — centralized acceptance gate and registry resolve.
//
// WHY THIS FILE EXISTS
// V4's bit-error acceptance band was previously applied by each caller, which
// means the answer to "is this recovery good enough?" depended on which endpoint
// you asked. That is precisely the failure mode baseMarkVerify.ts was created to
// end for V1/V2, and V4 is still admin-only, so this is the moment to fix it
// before any creator-reachable path exists.
//
// THE BAND, AND WHY IT IS A BAND
// audiowmark reports a bit-error rate on decode. Per BASE_MARK_FORENSIC_SPEC §11
// the measured separation sits in the 0.45-0.50 region: genuine recoveries land
// below the floor, and noise clusters above the ceiling. Between them is a zone
// where the evidence does not support a decision either way, and the correct
// output there is ABSTENTION, not a best guess (§8). A single threshold would
// force every ambiguous decode into one of two confident answers, which is how
// false attributions get manufactured.
export const V4_BIT_ERROR_ACCEPT_BELOW = 0.45;
export const V4_BIT_ERROR_ABSTAIN_ABOVE = 0.50;

// V4 IS NOT PRODUCTION. It has no approved acceptance gate on cascaded V1+V4
// material and no measured false-positive rate on speech. Keeping the flag here
// rather than in a caller means promotion is one reviewed change in one place,
// and no endpoint can quietly opt itself in.
export const V4_PRODUCTION_APPROVED = false;

/**
 * Classify a V4 decode. Returns 'accept' | 'abstain' | 'reject'.
 *
 * 'abstain' is a first-class outcome, not an error: it means the decode landed
 * inside the undecidable band and must be reported as "no determination",
 * never rounded to a hit or a miss.
 */
export function classifyV4BitError(bitError) {
  if (typeof bitError !== 'number' || !Number.isFinite(bitError)) return 'reject';
  if (bitError < V4_BIT_ERROR_ACCEPT_BELOW) return 'accept';
  if (bitError <= V4_BIT_ERROR_ABSTAIN_ABOVE) return 'abstain';
  return 'reject';
}

/**
 * Resolve a recovered V4 payload to its registry record.
 *
 * V4 carries the full 32-bit payload, so unlike the retired V3 slot table there
 * is no pointer indirection and no asset ceiling — a V4 recovery resolves
 * through the SAME registry lookup as V1 and V2. Registry confirmation is
 * mandatory: a payload matching no registered asset is a false positive and is
 * discarded (§8).
 */
export async function resolveV4Payload(base44, payloadHex) {
  if (!payloadHex) return null;
  const rows = await base44.asServiceRole.entities.UserAsset
    .filter({ 'metadata.base_mark_v4.payload_hex': payloadHex }, '-created_date', 5)
    .catch(() => []);
  if (rows?.length) return rows[0];

  // A V4 mark is cascaded on top of V1/V2, so the payload is derived from the
  // same asset id and will also be on record under the earlier layers. Falling
  // back to those is not a loosening of the check — it is the same registry,
  // reached by the other index.
  const [v1, v2] = await Promise.all([
    base44.asServiceRole.entities.UserAsset
      .filter({ 'metadata.base_mark.payload_hex': payloadHex }, '-created_date', 5).catch(() => []),
    base44.asServiceRole.entities.UserAsset
      .filter({ 'metadata.base_mark_v2.payload_hex': payloadHex }, '-created_date', 5).catch(() => []),
  ]);
  return v1?.[0] || v2?.[0] || null;
}

/**
 * Full V4 acceptance decision: band classification AND registry confirmation.
 * Both must pass. Returns a uniform verdict object so no caller has to
 * reimplement — or subtly weaken — either half.
 */
export async function acceptV4Recovery(base44, { payload_hex, bit_error }) {
  const band = classifyV4BitError(bit_error);
  if (band !== 'accept') {
    return { accepted: false, band, reason: band === 'abstain' ? 'undecidable_bit_error_band' : 'bit_error_too_high' };
  }
  const asset = await resolveV4Payload(base44, payload_hex);
  if (!asset) {
    return { accepted: false, band, reason: 'payload_not_in_registry' };
  }
  return {
    accepted: true,
    band,
    asset_id: asset.id,
    title: asset.title,
    production_approved: V4_PRODUCTION_APPROVED,
  };
}