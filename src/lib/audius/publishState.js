/**
 * Honest Audius publish-state classification.
 *
 * A track is only "live" when Audius actually returned a real track id.
 * Placeholder ids minted while the publish path is still a stub (`sim_…`,
 * `pending_…`) must never render as live, and must never produce an
 * audius.co link — that link 404s and tells the creator their track is
 * distributed when it never left the platform.
 */

export function isRealAudiusId(id) {
  if (!id || typeof id !== 'string') return false;
  return !id.startsWith('sim_') && !id.startsWith('pending_');
}

/**
 * @returns 'live' | 'simulated' | null
 */
export function audiusPublishState(trackId, status) {
  if (status === 'simulated') return 'simulated';
  if (!trackId) return null;
  return isRealAudiusId(String(trackId)) ? 'live' : 'simulated';
}

export function audiusTrackUrl(id) {
  return isRealAudiusId(id) ? `https://audius.co/tracks/${id}` : null;
}