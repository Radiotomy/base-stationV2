import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Film, FolderOpen, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import VideoAssetCard from '@/components/gallery/VideoAssetCard';

const PROVIDER_FILTERS = [
  { id: 'all', label: 'All Providers' },
  { id: 'ltx', label: '✨ LTX' },
  { id: 'shotstack', label: '🎬 Shotstack' },
];

const DATE_FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: '7d', label: 'Last 7 Days', days: 7 },
  { id: '30d', label: 'Last 30 Days', days: 30 },
  { id: '90d', label: 'Last 90 Days', days: 90 },
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'title', label: 'Title (A–Z)' },
];

// Heuristic: an asset is a "video" if asset_type === 'project' and file_url ends in a video extension,
// OR metadata.provider is a known video provider.
const VIDEO_PROVIDERS = new Set(['ltx', 'shotstack', 'nextcut']);
const isVideoAsset = (a) => {
  if (VIDEO_PROVIDERS.has(a.metadata?.provider)) return true;
  const url = (a.file_url || '').toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(url);
};

export default function AssetGallery() {
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [providerFilter, setProviderFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const loadAssets = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      // Renders land as asset_type 'video' when the server auto-saves them, and
      // as 'project' when saved manually from the composer — the gallery has to
      // read both or completed videos look like they were never saved.
      const [videos, projects] = await Promise.all([
        base44.entities.UserAsset.filter({ user_id: user.id, asset_type: 'video' }, '-created_date', 200),
        base44.entities.UserAsset.filter({ user_id: user.id, asset_type: 'project' }, '-created_date', 200),
      ]);
      setAssets([...videos, ...projects.filter(isVideoAsset)]);
    } catch (err) {
      toast.error('Failed to load gallery');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handleDelete = async (id) => {
    try {
      await base44.entities.UserAsset.delete(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      toast.success('Deleted');
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const filtered = useMemo(() => {
    let list = [...assets];

    // Provider filter
    if (providerFilter !== 'all') {
      list = list.filter((a) => a.metadata?.provider === providerFilter);
    }

    // Date filter
    const dateOpt = DATE_FILTERS.find((d) => d.id === dateFilter);
    if (dateOpt?.days) {
      const cutoff = Date.now() - dateOpt.days * 24 * 60 * 60 * 1000;
      list = list.filter((a) => new Date(a.created_date).getTime() >= cutoff);
    }

    // Sort
    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    } else if (sortBy === 'title') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    return list;
  }, [assets, providerFilter, dateFilter, sortBy]);

  // Provider counts (for badge display)
  const counts = useMemo(() => {
    const c = { all: assets.length, ltx: 0, shotstack: 0 };
    for (const a of assets) {
      const p = a.metadata?.provider;
      if (p && c[p] !== undefined) c[p]++;
    }
    return c;
  }, [assets]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={loadAssets} disabled={loading} className="gap-2 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-10 px-6 bg-gradient-to-br from-indigo-900/30 to-black">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight flex items-center gap-3">
            <FolderOpen className="w-10 h-10 text-indigo-400" />
            Asset Gallery
          </h1>
          <p className="text-white/60 text-base">
            All your generated videos in one place — preview, download, share, or delete.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Filters */}
        <div className="merc-card rounded-2xl p-4 space-y-4">
          {/* Provider filter */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Provider</p>
            <div className="flex flex-wrap gap-2">
              {PROVIDER_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setProviderFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    providerFilter === f.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {f.label}
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                    {counts[f.id] ?? 0}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Date + Sort */}
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Date Created</p>
              <div className="flex flex-wrap gap-1.5">
                {DATE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDateFilter(f.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      dateFilter === f.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Sort By</p>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSortBy(s.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      sortBy === s.id
                        ? 'bg-cyan-600 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="text-foreground font-bold">{filtered.length}</span> of{' '}
            <span className="text-foreground font-bold">{assets.length}</span> video
            {assets.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="merc-card rounded-2xl p-12 text-center">
            <Film className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-foreground font-bold mb-1">No videos found</p>
            <p className="text-sm text-muted-foreground mb-4">
              {assets.length === 0
                ? "You haven't generated any videos yet."
                : 'Try adjusting your filters.'}
            </p>
            <Link to="/video-studio">
              <Button className="bg-indigo-600 hover:bg-indigo-500 rounded-xl gap-2">
                <Film className="w-4 h-4" /> Open Video Studio
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filtered.map((asset) => (
                <VideoAssetCard key={asset.id} asset={asset} onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}