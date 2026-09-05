import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildAudiusPublishPayload } from '../../shared/audiusPublishPayload.ts';

/**
 * Phase 1 of a browser-side Audius publish: everything that must be decided
 * SERVER-SIDE before any bytes move.
 *
 * The browser is trusted to move the file (that is the whole point — our runtime
 * cannot send one this large), but it is NOT trusted to compose the release. Asset
 * ownership, the COS score, the AI disclosure label and the DDEX descriptors are
 * resolved here from stored records, so a creator cannot publish someone else's
 * track or overstate their own authorship by editing a request payload.
 *
 * Payload: { assetId, coverArtId? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, coverArtId } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });

    const assets = await base44.entities.UserAsset.filter({ id: assetId }).catch(() => []);
    const asset = assets[0];
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
    if (asset.user_id !== user.id) {
      return Response.json({ error: 'You do not own this asset' }, { status: 403 });
    }

    const payload = await buildAudiusPublishPayload(base44, user, asset, coverArtId);

    return Response.json({
      data: {
        asset_id: assetId,
        file_url: payload.fileUrl,
        cover_url: payload.coverUrl,
        // Sent as Audius expects it on createTrack: tags is a comma string, and
        // aiAttributionUserId is filled in by the browser with the OAuth user id
        // (Audius flags an AI release by attributing it to the uploading account).
        metadata: {
          ...payload.metadata,
          tags: payload.metadata.tags.join(','),
        },
        ai_disclosure_label: payload.disclosureLabel,
        provenance_embedded: payload.provenanceEmbedded,
      },
    });
  } catch (error) {
    const status = error.code === 'cover_art_required' ? 400 : 500;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
});