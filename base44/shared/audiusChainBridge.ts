/**
 * The Audius ↔ Base anchor bridge.
 *
 * Publishing to Audius and anchoring on Base are two independent provenance acts,
 * and they can happen in either order. This module is what makes each one point at
 * the other so a reader arriving from either side can resolve the whole claim:
 *
 *   anchor THEN publish → the calldata predates the release, so the Audius track id
 *                          cannot be in it. The link is written back onto the
 *                          registry row here (off-chain, because calldata is
 *                          immutable — a second anchor just to add an id would
 *                          spend gas to restate a claim that already exists).
 *   publish THEN anchor → the asset already carries audius_track_id, so the id goes
 *                          INTO the calldata at broadcast time (see chainAnchor.ts)
 *                          and the on-chain record names the release directly.
 *
 * The distinction is deliberate and must stay visible: an id inside the calldata is
 * an on-chain assertion, while one written here is our own database saying the two
 * records belong together. Collapsing them would overstate what the chain proves.
 */

/**
 * Records the Audius release on this asset's existing Base anchor, if it has one.
 *
 * Never fatal: a publish that succeeded must not be reported as failed because the
 * cross-reference could not be written. Returns what happened so callers can
 * surface it rather than guess.
 */
export async function linkAudiusReleaseToAnchor(
  base44: any,
  asset: any,
  { audiusTrackId, audiusPermalink }: { audiusTrackId: string; audiusPermalink?: string },
) {
  if (!audiusTrackId) return { linked: false, reason: 'no_track_id' };

  const registryId = asset?.chain_registry_id;
  if (!registryId) return { linked: false, reason: 'not_anchored' };

  try {
    const rows = await base44.asServiceRole.entities.BaseTrackRegistry.filter({ id: registryId });
    const record = rows?.[0];
    if (!record) return { linked: false, reason: 'registry_row_missing' };

    // An id already on the row was either put there by an earlier publish or is
    // inside the calldata itself. Overwriting it would silently repoint a
    // provenance record at a different release.
    if (record.audius_track_id) {
      return { linked: false, reason: 'already_linked', audius_track_id: record.audius_track_id };
    }

    await base44.asServiceRole.entities.BaseTrackRegistry.update(registryId, {
      audius_track_id: audiusTrackId,
      ...(audiusPermalink ? { audius_permalink: audiusPermalink } : {}),
      audius_link_basis: 'off_chain_backlink',
    });

    return { linked: true, registry_id: registryId, basis: 'off_chain_backlink' };
  } catch (error: any) {
    return { linked: false, reason: 'error', error: error.message };
  }
}