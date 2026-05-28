import { base44 } from '@/api/base44Client';

/**
 * Get the origin tag of an asset.
 * Returns: "creator" | "audius" | "loudly" (legacy only) | null
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
 * Check if asset can be published to Audius.
 * Legacy "loudly" origin (from removed Loudly integration) is still blocked.
 */
export async function canPublishToAudius(assetId) {
  const origin = await getAssetOrigin(assetId);
  return origin !== 'loudly';
}

/**
 * Sync filter — returns array of assets that pass the Audius gate.
 * Legacy "loudly" origin assets are excluded.
 */
export function filterAudiusEligible(assets = []) {
  return assets.filter(a => (a.origin || 'creator') !== 'loudly');
}

export const ORIGIN_LABEL = {
  creator: { label: 'Creator', color: 'bg-purple-500/20 text-purple-300', emoji: '🎨' },
  audius:  { label: 'Audius',  color: 'bg-emerald-500/20 text-emerald-300', emoji: '🎧' },
};