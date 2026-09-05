import { base44 } from '@/api/base44Client';

/**
 * Audius SDK singleton for the BROWSER.
 *
 * Audius' upload API is deliberately two-phase: the audio and artwork go straight
 * from here to a storage node, and only the resulting CIDs are registered on the
 * protocol. That is why this exists at all — our backend runtime cannot send a
 * multi-megabyte body, and Audius' own reference upload example is browser-only
 * for the same reason. Nothing here holds a write secret: OAuth PKCE replaces it.
 */

let sdkPromise = null;

// Registered as a redirect URI on the Audius developer app. Kept SEPARATE from
// /audius-callback, which belongs to the older server-side grant flow — one page
// cannot serve both, since the SDK expects to complete the exchange itself.
export const AUDIUS_REDIRECT_PATH = '/audius-oauth';

export function audiusRedirectUri() {
  return `${window.location.origin}${AUDIUS_REDIRECT_PATH}`;
}

export function getAudiusSdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const [{ sdk }, res] = await Promise.all([
        import('@audius/sdk'),
        base44.functions.invoke('audiusBrowserConfig', {}),
      ]);
      const apiKey = res?.data?.data?.api_key || res?.data?.api_key;
      if (!apiKey) throw new Error('Audius is not configured for this app.');
      return sdk({
        appName: 'BaseStation',
        apiKey,
        redirectUri: audiusRedirectUri(),
      });
    })().catch((e) => {
      // Never cache a failed init — a transient config fetch would otherwise
      // leave the whole publish flow permanently broken until a reload.
      sdkPromise = null;
      throw e;
    });
  }
  return sdkPromise;
}