// Cross-module inbox: BASE Foundry (and any other studio) queues an item here,
// then SUB-Station drains it on mount and turns it into a timeline track.
// A queue rather than a URL param because a patch graph is far too large for a URL.
const KEY = 'substation.inbox.v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function queueHandoff(item) {
  try {
    const list = read();
    list.push({ ...item, queued_at: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-12)));
  } catch { /* ignore */ }
}

export function drainHandoff() {
  const list = read();
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return list;
}

export function sendPatchToSubStation(plugin) {
  queueHandoff({
    kind: 'patch',
    plugin_id: plugin.id,
    title: plugin.title || 'Foundry Patch',
    category: plugin.category || 'effect',
    dsp_definition: plugin.dsp_definition || null,
    node_count: plugin.graph_state?.nodes?.length || 0,
  });
}

export function sendAssetToSubStation(asset) {
  queueHandoff({
    kind: 'asset',
    asset_id: asset.id,
    title: asset.title || 'Imported Audio',
    file_url: asset.file_url,
    asset_type: asset.asset_type,
  });
}