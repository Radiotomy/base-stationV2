// Mirrors a Foundry patch's signal flow onto desktop audio cables between the
// Audiotool devices its nodes are linked to. Unlinked or bypassed Foundry nodes
// are treated as pass-through, so a→(filter unlinked)→b still becomes a→b.

export function effectiveEdges(graph, links, bypassed) {
  const active = new Map(links.filter((l) => !bypassed.includes(l.node_id)).map((l) => [l.node_id, l.device_id]));
  const outgoing = new Map();
  for (const e of graph?.edges || []) {
    if (e.toParam) continue; // modulation, not audio
    if (!outgoing.has(e.from)) outgoing.set(e.from, []);
    outgoing.get(e.from).push(e.to);
  }
  const pairs = new Set();
  for (const [nodeId, dev] of active) {
    const seen = new Set();
    const stack = [...(outgoing.get(nodeId) || [])];
    while (stack.length) {
      const n = stack.pop();
      if (seen.has(n)) continue;
      seen.add(n);
      if (active.has(n)) { if (active.get(n) !== dev) pairs.add(`${dev}>${active.get(n)}`); }
      else stack.push(...(outgoing.get(n) || []));
    }
  }
  return [...pairs].map((k) => k.split('>'));
}

export function syncCables(nexus, pairs, links, deviceById) {
  const bound = new Set(links.map((l) => l.device_id));
  const want = new Set(pairs.map(([a, b]) => `${a}>${b}`));
  const sources = new Set(pairs.map((p) => p[0]));
  const targets = new Set(pairs.map((p) => p[1]));

  return nexus.modify((t) => {
    const have = new Set();
    let added = 0;
    let removed = 0;
    for (const c of t.entities.ofTypes('desktopAudioCable').get()) {
      const a = c.fields.fromSocket.value.entityId;
      const b = c.fields.toSocket.value.entityId;
      if (want.has(`${a}>${b}`)) { have.add(`${a}>${b}`); continue; }
      if ((bound.has(a) && bound.has(b)) || sources.has(a) || targets.has(b)) { t.remove(c); removed++; }
    }
    for (const [a, b] of pairs) {
      if (have.has(`${a}>${b}`)) continue;
      const A = deviceById.get(a)?.entity;
      const B = deviceById.get(b)?.entity;
      if (!A?.fields.audioOutput || !B?.fields.audioInput) continue;
      t.create('desktopAudioCable', { fromSocket: A.fields.audioOutput.location, toSocket: B.fields.audioInput.location });
      added++;
    }
    return { added, removed };
  });
}