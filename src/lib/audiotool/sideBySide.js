// Per-workspace side-by-side preference + the shared Audiotool pop-out window.
const key = (ws) => `at_split_${ws}`;

export function readSplit(ws) {
  try { return { open: false, size: 50, ...JSON.parse(localStorage.getItem(key(ws)) || '{}') }; }
  catch { return { open: false, size: 50 }; }
}

export const writeSplit = (ws, state) => localStorage.setItem(key(ws), JSON.stringify(state));

export const isSmallScreen = () => window.innerWidth < 1024;

/** Opens (or refocuses) one named Audiotool window docked to the right half of the screen. Returns false if blocked. */
export function openAudiotoolWindow(url) {
  const w = Math.round(window.screen.availWidth / 2);
  const h = window.screen.availHeight;
  const win = window.open(url, 'basestation_audiotool', `width=${w},height=${h},left=${w},top=0`);
  if (!win) return false;
  win.focus();
  return true;
}