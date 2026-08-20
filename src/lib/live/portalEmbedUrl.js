/**
 * Builds the Portals room URL for an embedded BASE Station stage.
 *
 * Portals exposes a set of documented query-string controls for embedders. We
 * use them so the iframe behaves like a BASE Station surface rather than a
 * branded Portals window: our own chrome is the only chrome, and a fan on a slow
 * connection waits rather than dropping into a half-loaded world.
 */

const PORTAL_ORIGIN = 'https://theportal.to/';

/**
 * @param {string} roomId          Portals room id
 * @param {object} opts
 * @param {boolean} opts.lockChrome  Hide Portals' own close/maximize buttons and
 *                                   open maximized, so the embed reads as ours.
 * @param {number}  opts.loadTime    Seconds to wait for a full load before
 *                                   entering anyway. Portals enters early if it
 *                                   finishes sooner, so this is a ceiling.
 * @param {string}  opts.avatarUrl   https URL of a GLB to use as the visitor's
 *                                   avatar (BASE Station collectible/profile).
 * @param {boolean} opts.guardian    Moderator view, for the performer/promoter.
 */
export function buildPortalEmbedUrl(roomId, opts = {}) {
  if (!roomId) return '';
  const { lockChrome = true, loadTime = 60, avatarUrl = '', guardian = false } = opts;

  const params = new URLSearchParams();
  params.set('room', roomId);

  if (lockChrome) {
    params.set('noCloseBtn', 'true');
    params.set('hideMaximizeButton', 'true');
    params.set('maximized', 'true');
  }
  if (loadTime) params.set('loadTime', String(loadTime));
  // Only https GLBs are accepted — a http/relative url silently drops the avatar
  if (avatarUrl && avatarUrl.startsWith('https://')) params.set('avatar', avatarUrl);
  if (guardian) params.set('guardian', 'true');

  return `${PORTAL_ORIGIN}?${params.toString()}`;
}

/** Plain shareable link for fans opening the venue in their own tab. */
export function buildPortalShareUrl(roomId) {
  return roomId ? `${PORTAL_ORIGIN}?room=${roomId}` : '';
}