import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getUserBearerToken } from '../../shared/audiusOAuth.ts';
import { buildAudiusPublishPayload } from '../../shared/audiusPublishPayload.ts';

/**
 * Publish a UserAsset (track) to Audius.
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

    // Pre-flight, genre normalization, ID3 provenance embed and the COS / DDEX /
    // C2PA compliance package — shared with the browser publish path so both
    // produce the same release.
    const prepared = await buildAudiusPublishPayload(base44, user, asset, coverArtId);
    const { cosScore, disclosureLabel, ddexMeta, c2paHash, provenanceEmbedded } = prepared;
    const publishFileUrl = prepared.fileUrl;
    const enrichedDescription = prepared.metadata.description;
    const complianceTags = prepared.metadata.tags;
    const audiusGenre = prepared.metadata.genre;
    const cover = { url: prepared.coverUrl };

    // Prefer the creator's OWN Audius grant. Without it the upload would be filed
    // under the platform's app account, which misattributes the release — the whole
    // point of the provenance metadata below is that the artist is stated correctly.
    const audiusAuth = await getUserBearerToken(base44, user.id, Deno.env.get('AUDIUS_API_KEY'));

    // Call audiusClient via service-role
    const publishRes = await base44.asServiceRole.functions.invoke('audiusClient', {
      action: 'publishTrack',
      payload: {
        title: asset.title,
        description: enrichedDescription,
        file_url: publishFileUrl,
        cover_url: cover.url,
        genre: audiusGenre,
        // Normalized by the shared payload builder — Audius' mood vocabulary is
        // closed, so a raw free-text mood is rejected after the upload completes.
        mood: prepared.metadata.mood,
        bpm: asset.metadata?.bpm,
        tags: complianceTags,
        // Whose Audius account the upload is filed under. Without it the client
        // reports SIMULATED rather than guessing an account. The OAuth grant wins over
        // the profile snapshot: the snapshot is display data a creator could have set
        // for any handle, while the grant is an account they proved they control.
        audius_user_id: audiusAuth?.audiusUserId || user.metadata?.audius?.audius_user_id,
        bearer_token: audiusAuth?.accessToken,
        isrc: asset.metadata?.isrc,
        stems,
        human_participation_score: cosScore,
        ai_disclosure_label: disclosureLabel,
        ddex_ai_metadata: ddexMeta,
        c2pa_provenance_hash: c2paHash,
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
        provenance_embedded: provenanceEmbedded,
      }
    });
  } catch (error) {
    const status = error.code === 'cover_art_required' ? 400 : 500;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
});