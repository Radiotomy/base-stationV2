import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Publish a UserAsset (track) to Audius.
 * Validates origin !== "loudly" before publishing.
 *
 * Payload: { assetId, metadata?, coverArtId?, stems? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, metadata = {}, coverArtId, stems = [] } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });

    // Fetch asset
    const assets = await base44.entities.UserAsset.filter({ id: assetId });
    const asset = assets[0];
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
    if (asset.user_id !== user.id) {
      return Response.json({ error: 'You do not own this asset' }, { status: 403 });
    }

    // === LEGAL GATE: legacy "loudly"-origin assets remain blocked ===
    const origin = asset.origin || 'creator';
    if (origin === 'loudly') {
      return Response.json({
        error: 'This legacy asset cannot be published to Audius due to its origin.',
        origin,
      }, { status: 403 });
    }

    // Required metadata
    if (!asset.title || !asset.file_url) {
      return Response.json({ error: 'Asset missing title or file_url' }, { status: 400 });
    }

    // Optional cover art
    let coverArt = null;
    if (coverArtId) {
      const cov = await base44.entities.UserAsset.filter({ id: coverArtId });
      coverArt = cov[0];
    }

    // Call audiusClient via service-role
    const publishRes = await base44.asServiceRole.functions.invoke('audiusClient', {
      action: 'publishTrack',
      payload: {
        title: asset.title,
        description: asset.description || '',
        file_url: asset.file_url,
        cover_url: coverArt?.file_url || asset.thumbnail_url,
        genre: asset.metadata?.genre,
        mood: asset.metadata?.mood,
        bpm: asset.metadata?.bpm,
        tags: asset.tags || [],
        stems,
        ...metadata,
      },
    });

    const audiusTrackId = publishRes?.data?.audius_track_id || publishRes?.audius_track_id;
    const status = publishRes?.data?.status || publishRes?.status || 'pending';

    // Persist Audius track ID into asset metadata
    await base44.entities.UserAsset.update(assetId, {
      metadata: {
        ...(asset.metadata || {}),
        audius_track_id: audiusTrackId,
        audius_publish_status: status,
        audius_published_at: new Date().toISOString(),
      },
    });

    return Response.json({
      data: {
        asset_id: assetId,
        audius_track_id: audiusTrackId,
        status,
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});