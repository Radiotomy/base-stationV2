import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { linkAudiusReleaseToAnchor } from '../../shared/audiusChainBridge.ts';

/**
 * One-off admin backfill for works that were BOTH published to Audius and anchored on
 * Base before the bridge existed.
 *
 * Every row it writes is necessarily an 'off_chain_backlink': these anchors were
 * already broadcast, and calldata is immutable — nothing this function does can turn a
 * historical anchor into an on-chain assertion about a release. That is the whole
 * reason it delegates the write to linkAudiusReleaseToAnchor instead of setting the
 * basis itself: one place decides how a link is labelled, so a backfill can never
 * quietly claim a stronger provenance than the chain actually carries.
 *
 * Re-runnable: the shared helper refuses to overwrite a row that already names a
 * release, so a second pass repoints nothing.
 *
 * Payload: { dryRun?: boolean, limit?: number }
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { dryRun = false, limit = 500 } = await req.json().catch(() => ({}));

    // Anchored assets are the only candidates — an unanchored release has no anchor
    // row to link, and is left alone rather than being anchored as a side effect.
    const anchored = await base44.asServiceRole.entities.UserAsset.filter(
      { chain_status: 'registered' },
      '-created_date',
      limit,
    );

    const results = { scanned: anchored.length, candidates: 0, linked: 0, skipped: [], errors: [] };

    for (const asset of anchored) {
      const audiusTrackId = asset.metadata?.audius_track_id;
      if (!audiusTrackId || !asset.chain_registry_id) continue;
      results.candidates += 1;

      if (dryRun) {
        results.skipped.push({ asset_id: asset.id, title: asset.title, reason: 'dry_run' });
        continue;
      }

      const outcome = await linkAudiusReleaseToAnchor(base44, asset, {
        audiusTrackId,
        audiusPermalink: asset.metadata?.audius_permalink,
      });

      if (outcome.linked) results.linked += 1;
      else if (outcome.reason === 'error') results.errors.push({ asset_id: asset.id, error: outcome.error });
      else results.skipped.push({ asset_id: asset.id, title: asset.title, reason: outcome.reason });
    }

    return Response.json({ data: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}