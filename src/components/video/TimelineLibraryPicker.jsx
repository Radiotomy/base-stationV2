import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Music, Film, Image as ImageIcon, Loader2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { kindFromAsset } from '@/lib/video/assetKind';

const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video', types: ['video', 'visualizer'] },
  { id: 'audio', label: 'Audio', types: ['track', 'master', 'stem', 'mashup', 'harmony', 'sfx'] },
  { id: 'image', label: 'Images', types: ['coverart'] },
];

const ICONS = { video: Film, audio: Music, image: ImageIcon };

/** Browses every usable asset in the user's library and drops it on the timeline. */
export default function TimelineLibraryPicker({ onPick, disabled }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await base44.auth.me();
      const rows = await base44.entities.UserAsset.filter({ user_id: user.id }, '-created_date', 200);
      if (!cancelled) {
        setAssets(rows.filter(a => a.file_url && a.asset_type !== 'lyric' && a.asset_type !== 'project'));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const types = GROUPS.find(g => g.id === group)?.types;
    return assets.filter(a =>
      (!types || types.includes(a.asset_type)) &&
      (!search || a.title?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [assets, group, search]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {GROUPS.map(g => (
          <button key={g.id} type="button" onClick={() => setGroup(g.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${group === g.id ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {g.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search your library…" className="pl-9 rounded-xl" />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {loading && (
          <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-6 text-center">No matching assets in your library.</p>
        )}
        {filtered.map(asset => {
          const kind = kindFromAsset(asset);
          const Icon = ICONS[kind] || Film;
          return (
            <button key={asset.id} type="button" disabled={disabled}
              onClick={() => onPick(kind, asset.file_url, asset.title)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card hover:border-indigo-500/50 transition-all text-left disabled:opacity-50">
              <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                {asset.thumbnail_url
                  ? <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  : <Icon className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{asset.title}</p>
                <div className="flex gap-1 mt-0.5">
                  <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">{asset.asset_type}</Badge>
                  <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">{kind}</Badge>
                </div>
              </div>
              <Plus className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}