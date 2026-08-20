import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PluginCard from './PluginCard';
import { newId } from '@/lib/foundry/nodeTypes';

const CATEGORIES = ['all', 'effect', 'instrument', 'utility', 'modulator'];

const SORTS = [
  { key: 'newest', label: 'Newest', apply: (a, b) => new Date(b.created_date) - new Date(a.created_date) },
  { key: 'forks', label: 'Most forked', apply: (a, b) => (b.fork_count || 0) - (a.fork_count || 0) },
  { key: 'design', label: 'Design score', apply: (a, b) => (b.human_score || 0) - (a.human_score || 0) },
];

// Community Foundry Hub — explore, audition and fork public plugins.
export default function CommunityFoundryHub() {
  const [plugins, setPlugins] = useState(null);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [forking, setForking] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.FoundryPlugin
      .filter({ is_public: true }, '-created_date', 60)
      .then(setPlugins)
      .catch(() => setPlugins([]));
  }, []);

  const fork = async (plugin) => {
    setForking(true);
    try {
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
        title: `${plugin.title} (fork)`,
        description: plugin.description,
        category: plugin.category,
        graph_state: { nodes, edges },
        dsp_definition: plugin.dsp_definition,
        tags: plugin.tags || [],
        fork_parent_id: plugin.id,
        is_public: false,
        // A fork does NOT inherit the parent's score — it starts from what this
        // creator has actually contributed, which so far is the act of forking.
        human_score: 10,
        participation_signals: { was_forked: true, label: 'ai_generated' },
      });
      await base44.entities.FoundryPlugin
        .update(plugin.id, { fork_count: (plugin.fork_count || 0) + 1 })
        .catch(() => {});
      navigate(`/foundry/${created.id}`);
    } catch (e) {
      toast({ title: 'Could not fork', description: e.message, variant: 'destructive' });
    } finally {
      setForking(false);
    }
  };

  const shown = (plugins || [])
    .filter((p) => category === 'all' || p.category === category)
    .sort((SORTS.find((s) => s.key === sort) || SORTS[0]).apply);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Users className="w-3.5 h-3.5 text-[#FF9A4D]" />
        <span className="text-[11px] uppercase tracking-widest text-white/50 mr-2">Community Foundry</span>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-2.5 py-1 rounded-lg text-[10px] capitalize transition-colors border ${
              category === c
                ? 'text-[#14100C] border-transparent merc-button'
                : 'text-white/50 border-white/10 bg-white/4 hover:text-white/80'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-white/30 mr-1">Sort</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors border ${
              sort === s.key
                ? 'text-white border-white/25 bg-white/10'
                : 'text-white/40 border-white/8 hover:text-white/70'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {plugins === null && (
        <div className="flex items-center gap-2 text-xs text-white/40 py-8">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading community patches…
        </div>
      )}

      {plugins && !shown.length && (
        <p className="text-xs text-white/40 py-8">
          No public patches in this category yet. Publish one and it shows up here.
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shown.map((p) => (
          <PluginCard key={p.id} plugin={p} onFork={fork} forking={forking} />
        ))}
      </div>
    </div>
  );
}