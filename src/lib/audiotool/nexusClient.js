// Audiotool OAuth 2.0 (Authorization Code + PKCE) and Nexus SDK bootstrap.
//
// The SDK's audiotool() does the whole PKCE dance: login() stores a verifier +
// state in localStorage and redirects to oauth.audiotool.com; when the browser
// comes back to the redirect URL with ?code=…, the NEXT audiotool() call on that
// page validates state, exchanges the code and strips it from the URL. So the
// redirect URL must be the exact page that calls audiotool() — here, "/".
import { audiotool } from '@audiotool/nexus';
import { base44 } from '@/api/base44Client';
import { ensureBrowserWasmLoader } from '@/lib/audiotool/nexusWasm';

export const AUDIOTOOL_APP_ORIGIN = 'https://basestation.live';
export const AUDIOTOOL_REDIRECT_URL = 'https://basestation.live/audiotool-callback';
// Only the scopes the Bridge uses: account name, project list/edit, sample
// upload (loops → timeline) + library download (Protect & Register), presets.
export const AUDIOTOOL_SCOPE = 'user:read project:read project:write sample:read sample:write preset:read';
const RETURN_KEY = 'audiotool_return_to';

let configPromise = null;
let clientPromise = null;

const getConfig = () => {
  configPromise ??= base44.functions.invoke('audiotoolConfig', {}).then((r) => r.data);
  return configPromise;
};
const getClientId = () => getConfig().then((c) => c.client_id);

/** "projects/{id}" of the Songstarter template, or null if none is configured. */
export const getTemplateProject = () => getConfig().then((c) => c.template_project || null);

/** One shared audiotool() result per page load — calling it twice would try to redeem the same code twice. */
export function getAudiotool() {
  clientPromise ??= Promise.all([getClientId(), ensureBrowserWasmLoader()]).then(([clientId]) =>
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