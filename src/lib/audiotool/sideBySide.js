// The shared Audiotool pop-out window, docked flush against the BASE Station window.
const NAME = 'basestation_audiotool';
const MIN_W = 640;

/** Where the pop-out goes: tight against our window's right edge, or the right half of the screen if there's no room. */
function dockRect() {
  const sx = window.screen.availLeft ?? 0;
  const sy = window.screen.availTop ?? 0;
  const sw = window.screen.availWidth;
  const sh = window.screen.availHeight;
  const right = window.screenX + window.outerWidth;
  const room = sx + sw - right;
  if (room >= MIN_W) {
    return { left: right, top: window.screenY, width: room, height: window.outerHeight };
  }
  const half = Math.round(sw / 2);
  return { left: sx + half, top: sy, width: sw - half, height: sh };
}

/** Opens (or re-docks and refocuses) the Audiotool window. Returns false if the pop-up was blocked. */
export function openAudiotoolWindow(url) {
  const r = dockRect();
  const win = window.open(url, NAME, `popup=yes,width=${r.width},height=${r.height},left=${r.left},top=${r.top}`);
  if (!win) return false;
  try { win.moveTo(r.left, r.top); win.resizeTo(r.width, r.height); } catch { /* browser may refuse; open position still applies */ }
  win.focus();
  return true;
}