// Opt-in automatic on-chain anchoring for newly created audio works.
//
// WHY OPT-IN, AND WHY THAT IS NOT A HEDGE: an anchor is permanent and public. It
// cannot be edited, deleted or withdrawn — a mistake can only be corrected by
// publishing a second anchor that names the first. Switching that on for
// everyone because a feature shipped would be making an irreversible public
// statement on a creator's behalf that they never asked for. So the owner must
// carry auto_anchor_provenance = true, and an asset belonging to anyone else is
// recorded as 'skipped' rather than silently ignored: 'skipped' means the
// decision was considered and declined, which is different from 'unregistered',
// which means nothing has looked yet.
//
// Anchoring logic is NOT duplicated here — it is the same shared core the manual
// "Register a Track" flow uses (shared/chainAnchor.ts).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';
import { anchorAssetForOwner } from '../../shared/chainAnchor.ts';

// Only whole works are anchored. A stem or a cover art is a component of a
// release, and anchoring each one would spend real gas to make dozens of
// near-identical public claims about a single piece of music.
//
// 'master' is also how an ORVO podcast episode reaches this policy: an episode
// mints a master asset from its audio, so podcasts are anchored through the same
// path as music rather than a parallel one.
//
// 'video' covers a finished generated video — a whole deliverable a creator
// publishes, unlike a 'visualizer', which is a derived accompaniment to a track
// that is itself already anchorable.
const ANCHORABLE_TYPES = ['track', 'master', 'mashup', 'video'];

// Same reasoning as autoBaseMarkV2: the automation body is caller-supplied and
// authorizes nothing, so every gate is re-derived from the stored record and
// anything older than this window is treated as a replay.
const AUTOMATION_MAX_AGE_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const isAutomation = body?.event?.entity_name === 'UserAsset';
    if (!isAutomation) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: admin only for direct invocation' }, { status: 403 });
      }
    }

    const assetId = isAutomation ? body.event.entity_id : body?.assetId;
    if (!assetId) return Response.json({ skipped: true, reason: 'No asset id' });

    const asset = await base44.asServiceRole.entities.UserAsset.get(assetId).catch(() => null);
    if (!asset) return Response.json({ skipped: true, reason: 'Asset not found' });

    if (isAutomation) {
      const ageMs = Date.now() - new Date(asset.created_date).getTime();
      if (!(ageMs >= 0 && ageMs < AUTOMATION_MAX_AGE_MS)) {
        return Response.json({ skipped: true, reason: 'Asset not newly created' });
      }
    }

    // Idempotency: an anchor already broadcast can never be taken back, so a
    // repeat run must never produce a second claim about the same work.
    // 'awaiting_mark' = a protected export whose anchor is deliberately held
    // until its watermark cascade finalizes (sealProtectedExport owns it).
    if (asset.chain_status === 'registered' || asset.chain_status === 'pending' || asset.chain_status === 'awaiting_mark') {
      return Response.json({ skipped: true, reason: `Already ${asset.chain_status}` });
    }
    if (!ANCHORABLE_TYPES.includes(asset.asset_type)) {
      return Response.json({ skipped: true, reason: `Type ${asset.asset_type} is not anchored` });
    }
    if (!asset.file_url || !asset.user_id) {
      return Response.json({ skipped: true, reason: 'Asset has no file or owner' });
    }

    const owners = await base44.asServiceRole.entities.User.filter({ id: asset.user_id }).catch(() => []);
    const owner = owners?.[0];
    if (!owner?.auto_anchor_provenance) {
      await base44.asServiceRole.entities.UserAsset.update(assetId, { chain_status: 'skipped' }).catch(() => {});
      return Response.json({ skipped: true, reason: 'Owner has not opted into automatic anchoring' });
    }

    // Claim before spending: the pending marker is what stops two concurrent
    // runs from broadcasting two anchors for one work.
    await base44.asServiceRole.entities.UserAsset.update(assetId, { chain_status: 'pending' });

    const result = await anchorAssetForOwner(base44, asset, owner, asset.file_url);
    return Response.json({ asset_id: assetId, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});