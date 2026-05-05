import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Music, Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * Phase 3 — Picks one or many UserAssets from the user's library.
 *
 * Props:
 *   - assetType: filter by 'track' | 'stem' | etc. (optional)
 *   - multi: boolean (default false)
 *   - max: max selections in multi mode
 *   - selected: array of ids
 *   - onChange: (ids) => void
 *   - excludeOrigins: array, e.g. ['loudly'] to enforce legal separation
 */
export default function AssetPicker({
  assetType = 'track',
  multi = false,
  max = 4,
  selected = [],
  onChange,
  excludeOrigins = [],
}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    base44.auth.me().then(user => {
      const filter = { user_id: user.id };
      if (assetType) filter.asset_type = assetType;
      base44.entities.UserAsset.filter(filter, '-created_date', 100)
        .then(rows => setAssets(rows.filter(a => !excludeOrigins.includes(a.origin))))
        .catch(() => setAssets([]))
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, [assetType, excludeOrigins.join(',')]);

  const filtered = assets.filter(a =>
    !search || a.title?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => {
    if (multi) {
      if (selected.includes(id)) onChange(selected.filter(x => x !== id));
      else if (selected.length < max) onChange([...selected, id]);
    } else {
      onChange(selected[0] === id ? [] : [id]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search your library…" className="pl-9 rounded-xl" />
      </div>

      <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
        {loading && <p className="text-xs text-muted-foreground py-4 text-center">Loading library…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">No matching assets in your library.</p>
        )}
        {filtered.map(asset => {
          const isSelected = selected.includes(asset.id);
          return (
            <button key={asset.id} type="button" onClick={() => toggle(asset.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${isSelected
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-border bg-card hover:border-purple-500/40'}`}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-700 to-indigo-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {asset.thumbnail_url
                  ? <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  : <Music className="w-4 h-4 text-white/60" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{asset.title}</p>
                <div className="flex gap-1 mt-0.5">
                  {asset.origin && <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">{asset.origin}</Badge>}
                  {asset.metadata?.bpm && <Badge variant="outline" className="text-xs px-1.5 py-0">{asset.metadata.bpm} BPM</Badge>}
                </div>
              </div>
              {isSelected && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {multi && (
        <p className="text-xs text-muted-foreground">
          {selected.length}/{max} selected
        </p>
      )}
    </div>
  );
}