import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Cpu, GitFork } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// A creator's public Foundry patches, shown on their artist profile.
// Public only — a private patch is work in progress, not a portfolio piece.
export default function CreatorPatchShowcase({ creatorId }) {
  const [patches, setPatches] = useState([]);

  useEffect(() => {
    if (!creatorId) return;
    base44.entities.FoundryPlugin
      .filter({ user_id: creatorId, is_public: true }, '-fork_count', 12)
      .then(setPatches)
      .catch(() => setPatches([]));
  }, [creatorId]);

  if (!patches.length) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-black text-foreground mb-5 flex items-center gap-2">
        <Cpu className="w-5 h-5 text-orange-400" /> Foundry Patches
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {patches.map((p) => (
          <Link
            key={p.id}
            to={`/foundry/${p.id}`}
            className="p-4 rounded-2xl bg-card border border-border hover:border-orange-500/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-foreground truncate">{p.title}</p>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {p.human_score ?? 0} design
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{p.category || 'effect'}</p>
            {p.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1.5">{p.description}</p>
            )}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2">
              <GitFork className="w-2.5 h-2.5" /> {p.fork_count || 0} forks
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}