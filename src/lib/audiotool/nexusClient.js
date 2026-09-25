// Audiotool OAuth 2.0 (Authorization Code + PKCE) and Nexus SDK bootstrap.
//
// The SDK's audiotool() does the whole PKCE dance: login() stores a verifier +
// state in localStorage and redirects to oauth.audiotool.com; when the browser
// comes back to the redirect URL with ?code=…, the NEXT audiotool() call on that
// page validates state, exchanges the code and strips it from the URL. So the
// redirect URL must be the exact page that calls audiotool() — here, "/".
import { audiotool } from '@audiotool/nexus';
import { base44 } from '@/api/base44Client';

export const AUDIOTOOL_APP_ORIGIN = 'https://basestation.live';
export const AUDIOTOOL_REDIRECT_URL = 'https://basestation.live/audiotool-callback';
export const AUDIOTOOL_SCOPE = 'project:write';
const RETURN_KEY = 'audiotool_return_to';

let clientIdPromise = null;
let clientPromise = null;

const getClientId = () => {
  clientIdPromise ??= base44.functions.invoke('audiotoolConfig', {}).then((r) => r.data.client_id);
  return clientIdPromise;
};

/** One shared audiotool() result per page load — calling it twice would try to redeem the same code twice. */
export function getAudiotool() {
  clientPromise ??= getClientId().then((clientId) =>
    audiotool({ clientId, redirectUrl: AUDIOTOOL_REDIRECT_URL, scope: AUDIOTOOL_SCOPE })
  );
  return clientPromise;
}

export const isOnPublishedOrigin = () => window.location.origin === AUDIOTOOL_APP_ORIGIN;

export async function loginToAudiotool(returnTo) {
  sessionStorage.setItem(RETURN_KEY, returnTo || '/');
  const at = await getAudiotool();
  if (at.status === 'unauthenticated') at.login();
}

export function takeReturnPath() {
  const path = sessionStorage.getItem(RETURN_KEY) || '/audiotool';
  sessionStorage.removeItem(RETURN_KEY);
  return path.startsWith('/') ? path : '/';
}