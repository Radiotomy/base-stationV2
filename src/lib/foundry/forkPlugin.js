import { base44 } from '@/api/base44Client';
import { newId } from './nodeTypes';

/**
 * Fork a FoundryPlugin into a private copy owned by the current user.
 *
 * Single source of truth for forking — the community hub, the starter-template
 * shelf and the read-only template inspector all route through here so a fork
 * behaves identically no matter which surface started it.
 */
export async function forkPlugin(plugin, { titlePrefix = '', titleSuffix = ' (fork)' } = {}) {
  const me = await base44.auth.me();

  // Fresh node ids: a fork that shares ids with its parent will collide the
  // moment a preset from either side is loaded into the other.
  const idMap = {};
  const nodes = (plugin.graph_state?.nodes || []).map((n) => {
    idMap[n.id] = newId('n');
    return { ...n, id: idMap[n.id] };
  });
  const edges = (plugin.graph_state?.edges || [])
    .filter((e) => idMap[e.from] && idMap[e.to])
    .map((e) => ({ ...e, id: newId('e'), from: idMap[e.from], to: idMap[e.to] }));

  const created = await base44.entities.FoundryPlugin.create({
    user_id: me.id,
    user_email: me.email,
    title: `${titlePrefix}${plugin.title}${titleSuffix}`,
    description: plugin.description,
    category: plugin.category,
    graph_state: { nodes, edges },
    dsp_definition: plugin.dsp_definition,
    tags: plugin.tags || [],
    fork_parent_id: plugin.id,
    is_public: false,
    // A fork never inherits the parent's score, and never inherits template
    // status — a copy of a reference patch is the forker's own work in progress.
    is_template: false,
    human_score: 10,
    participation_signals: { was_forked: true, label: 'ai_generated' },
  });

  await base44.entities.FoundryPlugin
    .update(plugin.id, { fork_count: (plugin.fork_count || 0) + 1 })
    .catch(() => {});

  return created;
}