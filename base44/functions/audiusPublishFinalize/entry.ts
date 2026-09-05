import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Phase 3 of a browser-side Audius publish: record the release.
 *
 * Only ever called with a track id Audius actually returned. A missing id is
 * rejected rather than stored as a pending release: an asset carrying an
 * audius_track_id renders in the app as live, so writing a placeholder here would
 * claim a distribution that never happened.
 *
 * Payload: { assetId, audiusTrackId, audiusUserId?, audiusHandle? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, audiusTrackId, audiusUserId, audiusHandle } = await req.json();
    if (!assetId || !audiusTrackId) {
      return Response.json({ error: 'assetId and audiusTrackId required' }, { status: 400 });
    }

    const assets = await base44.entities.UserAsset.filter({ id: assetId });
    const asset = assets[0];
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
    if (asset.user_id !== user.id) {
      return Response.json({ error: 'You do not own this asset' }, { status: 403 });
    }

    await base44.entities.UserAsset.update(assetId, {
      metadata: {
        ...(asset.metadata || {}),
        audius_track_id: audiusTrackId,
        audius_publish_status: 'success',
        audius_published_at: new Date().toISOString(),
        // Which Audius account the release actually landed under. Recorded because
        // the grant can later be disconnected or reconnected to a different account,
        // and the release must keep saying where it went.
        audius_published_by: audiusHandle || audiusUserId || undefined,
      },
    });

    return Response.json({ data: { asset_id: assetId, audius_track_id: audiusTrackId, status: 'success' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});