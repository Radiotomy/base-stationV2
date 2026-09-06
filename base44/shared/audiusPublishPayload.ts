/**
 * Builds the Audius release payload for a UserAsset — pre-flight checks, genre
 * normalization, and the COS / DDEX / C2PA compliance package.
 *
 * Extracted so the SERVER publish path and the BROWSER publish path produce a
 * byte-identical release. Duplicating it would let the two drift, and a release
 * whose disclosure footer depends on which code path uploaded it is not a
 * provenance record — it is two different claims about the same recording.
 */

import { normalizeAudiusGenre, normalizeAudiusMood, resolveCoverArtUrl, assertSourceReadable } from './audiusMetadata.ts';

export async function buildAudiusPublishPayload(base44, user, asset, coverArtId) {
  if (!asset.title || !asset.file_url) {
    throw new Error('Asset missing title or file_url');
  }

  // Audius validates artwork, genre and file readability at its content node, i.e.
  // AFTER the whole audio file has been streamed there. Checking first turns a slow
  // opaque rejection into an answer the creator can act on.
  await assertSourceReadable(asset.file_url);

  const cover = await resolveCoverArtUrl(base44, asset, coverArtId);
  if (!cover.url) {
    const err = new Error('Audius requires cover art on every release. Generate artwork for this track in the Cover Art Studio, then publish again.');
    err.code = 'cover_art_required';
    throw err;
  }

  // Audius' genre vocabulary is a closed list — free-text genre metadata from our
  // studios ("neo-soul", "lofi hip hop") is rejected unless translated.
  const audiusGenre = normalizeAudiusGenre(asset.metadata?.genre);

  // Embed COS provenance ID3 frames before publishing (mp3 only — ID3v2 is not
  // valid inside WAV containers). Non-fatal: publish the original on failure.
  let publishFileUrl = asset.file_url;
  let provenanceEmbedded = false;
  if (/\.mp3(\?|#|$)/i.test(asset.file_url)) {
    try {
      const tagRes = await base44.functions.invoke('editID3Tags', {
        audio_url: asset.file_url,
        asset_id: asset.id,
        tags: { title: asset.title, artist: user.full_name || 'BASE Station Artist' },
      });
      const taggedUrl = tagRes?.data?.download_url || tagRes?.download_url;
      if (taggedUrl) { publishFileUrl = taggedUrl; provenanceEmbedded = true; }
    } catch (_) { /* publish the original file */ }
  }

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

  // COS metrics, C2PA provenance hash and DDEX AI-attribution descriptors travel
  // natively in the description + tags so the release is self-authenticating on
  // Audius even for someone who never visits BASE Station.
  const disclosureLabel = asset.ai_disclosure_label || asset.ai_label || 'ai_generated';
  const c2paHash = asset.c2pa_provenance_hash || asset.metadata?.c2pa_provenance_hash || null;
  // Audius ↔ chain bridge, off-platform half: when this work is already anchored on
  // Base, the transaction is named in the release itself. That is what lets a
  // listener who never visits BASE Station verify the recording against a public
  // chain record instead of taking the footer's word for it.
  const anchorTxHash = asset.chain_status === 'registered' ? (asset.chain_tx_hash || null) : null;
  const ddexDescriptors = Object.entries(ddexMeta).filter(([, v]) => v === true).map(([k]) => k);
  const complianceFooter = [
    '─── PROVENANCE & AI DISCLOSURE (BASE Station) ───',
    `Creative Ownership Score (COS): ${cosScore}/100`,
    `AI Disclosure Label (RIAA/IFPI GenAI standard): ${disclosureLabel === 'ai_assisted' ? 'AI-Assisted' : disclosureLabel === 'human' ? 'Human' : 'AI-Generated'}`,
    `DDEX AI Attribution: ${ddexDescriptors.length > 0 ? ddexDescriptors.join(', ') : 'none declared'}`,
    c2paHash ? `C2PA Provenance Hash: ${c2paHash}` : null,
    anchorTxHash ? `On-Chain Provenance Anchor (Base mainnet): ${anchorTxHash}` : null,
    anchorTxHash ? `Verify: https://basescan.org/tx/${anchorTxHash}` : null,
    'Full provenance manifest available via BASE Station.',
  ].filter(Boolean).join('\n');

  const tags = [
    ...(asset.tags || []),
    `cos-${Math.round(cosScore)}`,
    disclosureLabel.replace(/_/g, '-'),
    ...ddexDescriptors.map((d) => `ddex-${d.replace(/_/g, '-')}`),
    ...(c2paHash ? ['c2pa-signed'] : []),
    ...(anchorTxHash ? ['base-anchored'] : []),
  ];

  // Audius caps a track description at 1000 characters and rejects the whole write
  // past it. The disclosure footer is the part that must survive, so the creator's
  // own prose is what gets trimmed.
  const footerRoom = 1000 - complianceFooter.length - 2;
  const ownDescription = (asset.description || '').slice(0, Math.max(0, footerRoom));
  const description = [ownDescription, complianceFooter].filter(Boolean).join('\n\n');

  // ISRC is format-validated by Audius (CCXXXYYNNNNN). Anything else is dropped
  // rather than sent — a malformed code would fail the release over a field the
  // track does not need.
  const rawIsrc = String(asset.metadata?.isrc || '').replace(/-/g, '').toUpperCase();
  const isrc = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(rawIsrc) ? rawIsrc : undefined;

  return {
    fileUrl: publishFileUrl,
    coverUrl: cover.url,
    provenanceEmbedded,
    cosScore,
    disclosureLabel,
    ddexMeta,
    c2paHash,
    anchorTxHash,
    metadata: {
      title: asset.title,
      description,
      genre: audiusGenre,
      mood: normalizeAudiusMood(asset.metadata?.mood),
      tags,
      isrc,
    },
  };
}