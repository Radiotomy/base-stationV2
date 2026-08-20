import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Library, Plus, Loader2, Lock, Globe } from 'lucide-react';
import CreateCollectionDialog from './CreateCollectionDialog';

// Patch collections — curated shelves of community patches.
// Pointer lists only: nothing here copies a graph, so collecting a patch
// never forks it or detaches it from its author.
export default function PatchCollections() {
  const [collections, setCollections] = useState(null);
  const [titles, setTitles] = useState({});
  const [creating, setCreating] = useState(false);

  const load = () => {
    base44.entities.FoundryCollection
      .list('-created_date', 30)
      .then(async (rows) => {
        setCollections(rows);
        const ids = [...new Set(rows.flatMap((c) => c.plugin_ids || []))];
        const found = await Promise.all(
          ids.map((id) => base44.entities.FoundryPlugin.filter({ id }).catch(() => []))
        );
        const map = {};
        found.forEach((r) => { if (r[0]) map[r[0].id] = r[0].title; });
        setTitles(map);
      })
      .catch(() => setCollections([]));
  };

  useEffect(load, []);

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Library className="w-3.5 h-3.5 text-[#FF9A4D]" />
          <span className="text-[11px] uppercase tracking-widest text-white/50">Collections</span>
        </div>
        <Button onClick={() => setCreating(true)} size="sm" className="h-7 text-[11px] merc-button">
          <Plus className="w-3 h-3 mr-1" /> New collection
        </Button>
      </div>

      {collections === null && (
        <div className="flex items-center gap-2 text-xs text-white/40 py-6">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading collections…
        </div>
      )}

      {collections && !collections.length && (
        <p className="text-xs text-white/40 py-4">
          No collections yet — group patches you love into a shelf others can browse.
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(collections || []).map((c) => (
          <div key={c.id} className="merc-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-white/90 truncate">{c.title}</h3>
              {c.is_public
                ? <Globe className="w-3 h-3 text-white/30 shrink-0" />
                : <Lock className="w-3 h-3 text-white/30 shrink-0" />}
            </div>
            {c.description && (
              <p className="text-[11px] text-white/45 line-clamp-2 mt-1">{c.description}</p>
            )}
            <div className="mt-2.5 space-y-1">
              {(c.plugin_ids || []).slice(0, 4).map((id) =>
                titles[id] ? (
                  <Link
                    key={id}
                    to={`/foundry/${id}`}
                    className="block text-[11px] text-white/60 hover:text-[#FFC98A] truncate"
                  >
                    · {titles[id]}
                  </Link>
                ) : null
              )}
            </div>
            <p className="text-[9px] font-mono text-white/30 mt-2.5">
              {(c.plugin_ids || []).length} patches
            </p>
          </div>
        ))}
      </div>

      {creating && (
        <CreateCollectionDialog
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      )}
    </div>
  );
}