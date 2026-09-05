import { base44 } from '@/api/base44Client';

/**
 * Get the origin tag of an asset.
 * Returns: "creator" | "audius" | null
 */
export async function getAssetOrigin(assetId) {
  if (!assetId) return null;
  try {
    const results = await base44.entities.UserAsset.filter({ id: assetId });
    return results[0]?.origin || 'creator';
  } catch {
    return null;
  }
}

/**
 * Check if asset can be published to Audius. Every origin the platform still
 * produces (creator, audius) is eligible — there is no restricted origin.
 */
export async function canPublishToAudius(assetId) {
  return !!(await getAssetOrigin(assetId));
}

/** Sync filter — every asset with a known origin is Audius-eligible. */
export function filterAudiusEligible(assets = []) {
  return assets;
}

export const ORIGIN_LABEL = {
  creator: { label: 'Creator', color: 'bg-purple-500/20 text-purple-300', emoji: '🎨' },
  audius:  { label: 'Audius',  color: 'bg-emerald-500/20 text-emerald-300', emoji: '🎧' },
};