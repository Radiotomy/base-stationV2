import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    // Embed COS provenance ID3 frames into the audio buffer before publishing
    // (mp3 only — ID3v2 is not valid inside WAV containers). Non-fatal on failure.
    let publishFileUrl = asset.file_url;
    let provenanceEmbedded = false;
    if (/\.mp3(\?|#|$)/i.test(asset.file_url)) {
      try {
        const tagRes = await base44.functions.invoke('editID3Tags', {
          audio_url: asset.file_url,
          asset_id: assetId,
          tags: { title: asset.title, artist: user.full_name || 'BASE Station Artist' },
        });
        const taggedUrl = tagRes?.data?.download_url || tagRes?.download_url;
        if (taggedUrl) { publishFileUrl = taggedUrl; provenanceEmbedded = true; }
      } catch (_) { /* publish the original file */ }
    }

    // COS / DDEX provenance travels with the publish payload
    const sig = asset.participation_signals || {};
    const cosScore = asset.human_participation_score ?? 0;
    const ddexMeta = (asset.ddex_ai_metadata && Object.keys(asset.ddex_ai_metadata).length > 0)
      ? asset.ddex_ai_metadata
      : {
          ai_lyrical_content: !sig.user_content,
          ai_composition: cosScore < 50,
          ai_instrumentation: !sig.reference_material,
          ai_generated_vocals: !!sig.persona_used,
          ai_post_production: asset.asset_type === 'master',
        };

    // === COMPLIANCE-ENRICHED EXPORT PACKAGE ===
    // COS metrics, C2PA provenance hash, and DDEX AI-attribution descriptors
    // travel natively in the track description + tags so the release is
    // self-authenticating on Audius.
    const disclosureLabel = asset.ai_disclosure_label || asset.ai_label || 'ai_generated';
    const c2paHash = asset.c2pa_provenance_hash || asset.metadata?.c2pa_provenance_hash || null;
    const ddexDescriptors = Object.entries(ddexMeta)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    const complianceFooter = [
      '─── PROVENANCE & AI DISCLOSURE (BASE Station) ───',
      `Creative Ownership Score (COS): ${cosScore}/100`,
      `AI Disclosure Label (RIAA/IFPI GenAI standard): ${disclosureLabel === 'ai_assisted' ? 'AI-Assisted' : disclosureLabel === 'human' ? 'Human' : 'AI-Generated'}`,
      `DDEX AI Attribution: ${ddexDescriptors.length > 0 ? ddexDescriptors.join(', ') : 'none declared'}`,
      c2paHash ? `C2PA Provenance Hash: ${c2paHash}` : null,
      'Full provenance manifest available via BASE Station.',
    ].filter(Boolean).join('\n');
    const enrichedDescription = [asset.description || '', complianceFooter].filter(Boolean).join('\n\n');
    const complianceTags = [
      ...(asset.tags || []),
      `cos-${Math.round(cosScore)}`,
      disclosureLabel.replace(/_/g, '-'),
      ...ddexDescriptors.map((d) => `ddex-${d.replace(/_/g, '-')}`),
      ...(c2paHash ? ['c2pa-signed'] : []),
    ];

    // Call audiusClient via service-role
    const publishRes = await base44.asServiceRole.functions.invoke('audiusClient', {
      action: 'publishTrack',
      payload: {
        title: asset.title,
        description: enrichedDescription,
        file_url: publishFileUrl,
        cover_url: coverArt?.file_url || asset.thumbnail_url,
        genre: asset.metadata?.genre,
        mood: asset.metadata?.mood,
        bpm: asset.metadata?.bpm,
        tags: complianceTags,
        // Whose Audius account the upload is filed under. Without it the client
        // reports SIMULATED rather than guessing an account.
        audius_user_id: user.metadata?.audius?.audius_user_id,
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});