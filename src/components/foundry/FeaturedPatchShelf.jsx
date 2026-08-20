import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Flame, GitFork, Loader2 } from 'lucide-react';

// Most-forked public patches — forks are the clearest signal that a design was
// useful to someone else, so the shelf ranks by them rather than by recency.
export default function FeaturedPatchShelf() {
  const [top, setTop] = useState(null);

  useEffect(() => {
    base44.entities.FoundryPlugin
      .filter({ is_public: true }, '-fork_count', 6)
      .then((rows) => setTop(rows.filter((p) => (p.fork_count || 0) > 0)))
      .catch(() => setTop([]));
  }, []);

  if (top === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/40 py-6">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading featured patches…
      </div>
    );
  }

  if (!top.length) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-3.5 h-3.5 text-[#FF9A4D]" />
        <span className="text-[11px] uppercase tracking-widest text-white/50">Most forked</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {top.map((p) => (
          <Link
            key={p.id}
            to={`/foundry/${p.id}`}
            className="merc-card merc-card-hover rounded-2xl p-3 min-w-[180px] shrink-0 transition-all"
          >
            <p className="text-sm font-semibold text-white/90 truncate">{p.title}</p>
            <p className="text-[9px] uppercase tracking-widest text-[#FF9A4D] mt-0.5">
              {p.category || 'effect'}
            </p>
            <div className="flex items-center gap-1 text-[10px] font-mono text-white/40 mt-2">
              <GitFork className="w-2.5 h-2.5" />
              {p.fork_count || 0} forks
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}