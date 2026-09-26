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
// The disclosure package is shared with the metadata-refresh path so a correction
// to a live release restates the same claim rather than composing a new one.
import { buildComplianceMetadata, normalizeIsrc } from './audiusCompliance.ts';

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

  // COS metrics, C2PA provenance hash and DDEX AI-attribution descriptors travel
  // natively in the description + tags so the release is self-authenticating on
  // Audius even for someone who never visits BASE Station.
  const compliance = buildComplianceMetadata(asset);
  const { cosScore, disclosureLabel, ddexMeta, c2paHash, anchorTxHash, description, tags } = compliance;

  // ISRC is format-validated by Audius (CCXXXYYNNNNN). Anything else is dropped
  // rather than sent — a malformed code would fail the release over a field the
  // track does not need.
  const isrc = normalizeIsrc(asset.metadata?.isrc);

  // Tempo carried from the source session (e.g. the Audiotool project BPM).
  const rawBpm = Number(asset.metadata?.bpm);
  const bpm = Number.isFinite(rawBpm) && rawBpm >= 20 && rawBpm <= 400 ? Math.round(rawBpm * 100) / 100 : undefined;

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
      ...(bpm ? { bpm, isCustomBpm: true } : {}),
    },
  };
}