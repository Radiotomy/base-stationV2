import { base44 } from '@/api/base44Client';

/**
 * Walk a plugin's fork_parent_id chain to find how deep it sits and what it came from.
 *
 * Capped at MAX_HOPS: a lineage is display credit, not a graph traversal exercise,
 * and a corrupted parent pointer must never spin this forever.
 */
const MAX_HOPS = 8;

export async function resolveForkLineage(plugin) {
  if (!plugin?.fork_parent_id) {
    return { fork_parent_id: null, fork_parent_title: null, fork_depth: 0 };
  }

  let depth = 0;
  let parentTitle = null;
  let cursor = plugin.fork_parent_id;
  const seen = new Set([plugin.id]);

  while (cursor && depth < MAX_HOPS && !seen.has(cursor)) {
    seen.add(cursor);
    const found = await base44.entities.FoundryPlugin.filter({ id: cursor }).catch(() => []);
    const parent = found[0];
    depth += 1;
    if (depth === 1) parentTitle = parent?.title || 'a community patch';
    if (!parent) break;
    cursor = parent.fork_parent_id;
  }

  return {
    fork_parent_id: plugin.fork_parent_id,
    fork_parent_title: parentTitle,
    fork_depth: depth,
  };
}