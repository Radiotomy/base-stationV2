/**
 * The COS / DDEX / C2PA disclosure package carried in an Audius release's own
 * description and tags.
 *
 * Extracted from audiusPublishPayload.ts because a metadata-only REFRESH needs the
 * exact same package as a first publish. The whole point of the refresh path is to
 * correct a disclosure label on a track that is already live — if the two paths
 * composed the footer separately they would drift, and a "correction" would then be
 * a third, different claim about the same recording rather than a restatement of
 * the stored one.
 *
 * Reads only from the stored asset. Nothing here accepts client input: the label a
 * release declares must come from our own records, never from whoever pressed the
 * button.
 */

/** Audius rejects the whole write past this, so the footer is budgeted against it. */
const MAX_DESCRIPTION = 1000;

export function buildComplianceMetadata(asset) {
  const sig = asset.participation_signals || {};
  const cosScore = asset.human_participation_score ?? 0;

  // A stored DDEX profile wins; the fallback is derived from COS telemetry only
  // when the asset never had one computed.
  const ddexMeta = (asset.ddex_ai_metadata && Object.keys(asset.ddex_ai_metadata).length > 0)
    ? asset.ddex_ai_metadata
    : {
        ai_lyrical_content: !sig.user_content,
        ai_composition: cosScore < 50,
        ai_instrumentation: !sig.reference_material,
        ai_generated_vocals: !!sig.persona_used,
        ai_post_production: asset.asset_type === 'master',
      };

  const disclosureLabel = asset.ai_disclosure_label || asset.ai_label || 'ai_generated';
  const c2paHash = asset.c2pa_provenance_hash || asset.metadata?.c2pa_provenance_hash || null;

  // Audius ↔ chain bridge, off-platform half: only a REGISTERED anchor is named.
  // Naming a pending one would advertise a transaction that may never confirm.
  const anchorTxHash = asset.chain_status === 'registered' ? (asset.chain_tx_hash || null) : null;

  const ddexDescriptors = Object.entries(ddexMeta).filter(([, v]) => v === true).map(([k]) => k);

  const footer = [
    '─── PROVENANCE & AI DISCLOSURE (BASE Station) ───',
    `Creative Ownership Score (COS): ${cosScore}/100`,
    `AI Disclosure Label (RIAA/IFPI GenAI standard): ${disclosureLabel === 'ai_assisted' ? 'AI-Assisted' : disclosureLabel === 'human' ? 'Human' : 'AI-Generated'}`,
    `DDEX AI Attribution: ${ddexDescriptors.length > 0 ? ddexDescriptors.join(', ') : 'none declared'}`,
    c2paHash ? `C2PA Provenance Hash: ${c2paHash}` : null,
    anchorTxHash ? `On-Chain Provenance Anchor (Base mainnet): ${anchorTxHash}` : null,
    anchorTxHash ? `Verify: https://basescan.org/tx/${anchorTxHash}` : null,
    'Full provenance manifest available via BASE Station.',
  ].filter(Boolean).join('\n');

  // The disclosure footer is the part that must survive the character cap, so the
  // creator's own prose is what gets trimmed rather than the declaration.
  const footerRoom = MAX_DESCRIPTION - footer.length - 2;
  const ownDescription = (asset.description || '').slice(0, Math.max(0, footerRoom));

  const tags = [
    ...(asset.tags || []),
    `cos-${Math.round(cosScore)}`,
    disclosureLabel.replace(/_/g, '-'),
    ...ddexDescriptors.map((d) => `ddex-${d.replace(/_/g, '-')}`),
    ...(c2paHash ? ['c2pa-signed'] : []),
    ...(anchorTxHash ? ['base-anchored'] : []),
  ];

  return {
    cosScore,
    disclosureLabel,
    ddexMeta,
    c2paHash,
    anchorTxHash,
    ddexDescriptors,
    footer,
    description: [ownDescription, footer].filter(Boolean).join('\n\n'),
    tags,
  };
}

/**
 * ISRC as Audius will accept it, or undefined.
 *
 * Undefined rather than an empty string is load-bearing on the UPDATE path: an
 * empty value would overwrite a real ISRC already on the live release.
 */
export function normalizeIsrc(raw) {
  const isrc = String(raw || '').replace(/-/g, '').toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc) ? isrc : undefined;
}