// BASE Station deep links into the Audiotool Bridge:
//   /audiotool?open=<studio link>&focus=<entity id>
// Opening one signs in if needed (the return path keeps the query), opens the
// project live and highlights the track or device in the Session Explorer.
export function bridgeLink(projectUrl, focusId) {
  const q = new URLSearchParams({ open: projectUrl });
  if (focusId) q.set('focus', focusId);
  return `${window.location.origin}/audiotool?${q}`;
}

export function readDeepLink() {
  const q = new URLSearchParams(window.location.search);
  return { open: q.get('open') || '', focus: q.get('focus') || '' };
}

/** Keeps the address bar pointing at the open project, so reloads and shares land back here. */
export function syncAddressBar(projectUrl) {
  const q = new URLSearchParams(window.location.search);
  if (q.get('open') === projectUrl) return;
  q.set('open', projectUrl);
  q.delete('focus');
  window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
}

export async function copyBridgeLink(projectUrl, focusId) {
  await navigator.clipboard.writeText(bridgeLink(projectUrl, focusId));
}