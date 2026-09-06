import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getUserBearerToken } from '../../shared/audiusOAuth.ts';
import { buildComplianceMetadata, normalizeIsrc } from '../../shared/audiusCompliance.ts';
import { normalizeAudiusGenre, normalizeAudiusMood } from '../../shared/audiusMetadata.ts';
import { updateTrackOnAudius } from '../../shared/audiusUpdate.ts';

/**
 * Pushes a corrected provenance package to a track already live on Audius.
 *
 * The case this exists for: a COS score is recomputed, or a disclosure label is
 * corrected from ai_generated to ai_assisted, AFTER the track was published. Before
 * this, that correction could only reach BASE Station's own surfaces — the live
 * release kept declaring the superseded label, which is the one place the
 * declaration actually matters.
 *
 * The correction is composed SERVER-SIDE from the stored asset. Nothing about the
 * declared label, score or DDEX profile can be supplied by the caller: a creator
 * must not be able to talk their own release into a better disclosure than their
 * records support. The only thing the caller chooses is WHICH of their assets to
 * restate.
 *
 * Payload: { assetId }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });

    const assets = await base44.entities.UserAsset.filter({ id: assetId });
    const asset = assets[0];
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
    if (asset.user_id !== user.id) {
      return Response.json({ error: 'You do not own this asset' }, { status: 403 });
    }

    const audiusTrackId = asset.metadata?.audius_track_id;
    if (!audiusTrackId || String(audiusTrackId).startsWith('sim_')) {
      // A simulated id never corresponded to a release, so there is nothing live to
      // correct. Saying so plainly beats attempting an edit against a fiction.
      return Response.json({
        error: 'This track is not live on Audius yet — publish it first.',
        code: 'not_published',
      }, { status: 400 });
    }

    // A metadata edit is a write against the creator's OWN account, so it needs
    // their grant. Falling back to the app credential would aim the edit at the
    // platform account and fail — or worse, succeed against the wrong release.
    const apiKey = Deno.env.get('AUDIUS_API_KEY');
    const audiusAuth = await getUserBearerToken(base44, user.id, apiKey);
    const audiusUserId = audiusAuth?.audiusUserId || user.metadata?.audius?.audius_user_id;
    if (!audiusUserId) {
      return Response.json({
        error: 'Connect your Audius account in Distribution before editing a release.',
        code: 'not_connected',
      }, { status: 400 });
    }

    // Recomposed from the stored record, identical to what a fresh publish would
    // declare today.
    const compliance = buildComplianceMetadata(asset);

    // Calls the shared update module directly rather than hopping through
    // audiusClient: the hop added nothing but a second failure surface, and the
    // shared module is already the single place a track edit is defined.
    const result = await updateTrackOnAudius({
      apiKey,
      apiSecret: Deno.env.get('AUDIUS_API_SECRET'),
      bearerToken: audiusAuth?.accessToken,
      audiusUserId,
      audiusTrackId,
      changes: {
        title: asset.title,
        description: compliance.description,
        genre: normalizeAudiusGenre(asset.metadata?.genre),
        mood: normalizeAudiusMood(asset.metadata?.mood),
        tags: compliance.tags,
        isrc: normalizeIsrc(asset.metadata?.isrc),
      },
    });

    const updatedFields = result.updated || [];
    // Recorded so the library can show whether the live release reflects the
    // CURRENT score — a track published under an old label and never refreshed is
    // materially different from one that has been restated.
    await base44.entities.UserAsset.update(assetId, {
      metadata: {
        ...(asset.metadata || {}),
        audius_metadata_refreshed_at: new Date().toISOString(),
        audius_declared_cos: compliance.cosScore,
        audius_declared_label: compliance.disclosureLabel,
      },
    });

    return Response.json({
      data: {
        asset_id: assetId,
        audius_track_id: audiusTrackId,
        updated_fields: updatedFields,
        unchanged: !!result.unchanged,
        declared_cos: compliance.cosScore,
        declared_label: compliance.disclosureLabel,
      }
    });
  } catch (error) {
    // Surface the INNER failure. An invoke that fails arrives here as a bare
    // "Request failed with status code N", which names the transport and hides the
    // reason — useless to a creator and to anyone debugging a release edit.
    const inner = error?.response?.data?.error || error?.response?.data;
    return Response.json({
      error: inner ? (typeof inner === 'string' ? inner : JSON.stringify(inner)) : error.message,
    }, { status: 500 });
  }
});