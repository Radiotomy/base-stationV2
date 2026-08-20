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
import { resolvePayload } from './baseMarkResolve.ts';
import { V4_BEARER_COPY_ID } from './baseMarkV4Message.ts';

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
 *
 * PHASE 2: delegated to the shared resolver. This previously took `rows[0]` when
 * several assets matched, which turned a payload collision into a confident
 * attribution of the most recent one. The resolver abstains instead, and returns
 * null here — the cascade fallback to the V1/V2 indexes it used to do by hand is
 * now part of the resolver's single index list.
 */
export async function resolveV4Payload(base44, payloadHex) {
  const verdict = await resolvePayload(base44, { payload_hex: payloadHex });
  return verdict.attributed ? verdict.asset : null;
}

/**
 * Resolve a recovered copy id to its issuance record. PHASE 6.
 *
 * A copy id is only evidence if something says who the copy went to, so an id
 * with no issuance record is reported as UNKNOWN rather than trusted: the tag
 * proves the id was written by us, but not that this particular id was ever
 * issued, and a copy record could have been deleted. Scoped to the resolved
 * asset — a copy id is unique within an asset, not globally.
 */
export async function resolveCopy(base44, assetId, copyIdHex) {
  if (!copyIdHex || copyIdHex === V4_BEARER_COPY_ID) {
    return { per_copy: false, copy: null, status: 'bearer_copy' };
  }
  const svc = base44.asServiceRole || base44;
  const rows = await svc.entities.BaseMarkCopy
    .filter({ asset_id: assetId, copy_id: copyIdHex }, '-created_date', 2)
    .catch(() => []);
  if (!rows.length) return { per_copy: true, copy: null, status: 'copy_not_on_record' };
  return { per_copy: true, copy: rows[0], status: rows[0].status === 'revoked' ? 'copy_revoked' : 'copy_identified' };
}

/**
 * Full V4 acceptance decision: band classification AND registry confirmation.
 * Both must pass. Returns a uniform verdict object so no caller has to
 * reimplement — or subtly weaken — either half.
 *
 * PHASE 6: when the message carried a copy id, the verdict also names the copy.
 * That is what upgrades the claim from §8.2's narrow "this signature belongs to
 * asset X" to "this audio carries the copy issued to Y" — the replay gap, closed
 * for this layer only.
 */
export async function acceptV4Recovery(base44, { payload_hex, bit_error, copy_id }) {
  const band = classifyV4BitError(bit_error);
  if (band !== 'accept') {
    return { accepted: false, band, reason: band === 'abstain' ? 'undecidable_bit_error_band' : 'bit_error_too_high' };
  }
  // The verdict carries WHY resolution failed, and the distinction matters: an
  // unregistered payload is a false positive, while a colliding one is a real
  // mark the registry simply cannot disambiguate. Both refuse attribution, but
  // only the second is a data problem worth investigating.
  const verdict = await resolvePayload(base44, { payload_hex });
  if (!verdict.attributed) {
    return { accepted: false, band, reason: verdict.status };
  }
  const asset = verdict.asset;
  const copy = await resolveCopy(base44, asset.id, copy_id);
  return {
    accepted: true,
    band,
    asset_id: asset.id,
    title: asset.title,
    per_copy: copy.per_copy,
    copy_status: copy.status,
    copy_id: copy.per_copy ? copy_id : null,
    issued_to: copy.copy?.issued_to || null,
    copy_purpose: copy.copy?.purpose || null,
    production_approved: V4_PRODUCTION_APPROVED,
  };
}