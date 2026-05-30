import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Music, Search, ExternalLink, Link2, Eye, Heart, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_COLOR = {
  approved: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  rejected: 'bg-destructive/20 text-destructive',
};

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'plays', label: 'Most Plays' },
  { id: 'likes', label: 'Most Likes' },
  { id: 'title', label: 'Title A–Z' },
];

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="flex-1 min-w-[120px] p-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <p className="text-xl font-black text-foreground">{value}</p>
    </div>
  );
}

export default function SubmissionsTab({ tracks }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Status counts
  const counts = useMemo(() => {
    const c = { all: tracks.length, approved: 0, pending: 0, rejected: 0 };
    for (const t of tracks) if (c[t.status] !== undefined) c[t.status]++;
    return c;
  }, [tracks]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const totalPlays = tracks.reduce((s, t) => s + (t.play_count || 0), 0);
    const totalLikes = tracks.reduce((s, t) => s + (t.like_count || 0), 0);
    const engagement = totalPlays > 0 ? ((totalLikes / totalPlays) * 100).toFixed(1) : '0.0';
    return { totalPlays, totalLikes, engagement };
  }, [tracks]);

  // Filter + sort pipeline
  const filtered = useMemo(() => {
    let list = [...tracks];
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((t) => (t.title || '').toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'oldest':
        list.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        break;
      case 'plays':
        list.sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
        break;
      case 'likes':
        list.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        break;
      case 'title':
        list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'newest':
      default:
        list.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }
    return list;
  }, [tracks, statusFilter, search, sortBy]);

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const STATUS_TABS = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'approved', label: '✅ Approved', count: counts.approved },
    { id: 'pending', label: '⏳ Pending', count: counts.pending },
    { id: 'rejected', label: '❌ Rejected', count: counts.rejected },
  ];

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''} submitted
        </p>
        <Link to="/submit">
          <Button className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-500 text-sm font-bold">
            <Plus className="w-4 h-4" /> Submit New Track
          </Button>
        </Link>
      </div>

      {/* Aggregate stats strip */}
      {tracks.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          <MiniStat icon={Eye} label="Total Plays" value={aggregateStats.totalPlays.toLocaleString()} />
          <MiniStat icon={Heart} label="Total Likes" value={aggregateStats.totalLikes.toLocaleString()} />
          <MiniStat icon={BarChart3} label="Engagement" value={`${aggregateStats.engagement}%`} />
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setStatusFilter(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === t.id ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {t.label} <span className="opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Search + sort row */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracks by title…"
            className="pl-9 h-9 rounded-xl text-sm"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-9 px-3 rounded-xl text-sm bg-muted border border-border text-foreground font-semibold cursor-pointer focus:outline-none focus:border-purple-500"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              Sort: {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {tracks.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Music className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground text-sm mb-3">No tracks submitted yet.</p>
          <Link to="/submit">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 rounded-xl gap-2">
              <Plus className="w-3.5 h-3.5" /> Submit Your First Track
            </Button>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground text-sm">No tracks match these filters.</p>
          <button
            onClick={() => {
              setStatusFilter('all');
              setSearch('');
            }}
            className="text-purple-400 text-xs hover:text-purple-300 mt-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((track) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-card border border-border hover:border-purple-500/30 transition-all flex items-center gap-4 group"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-800 to-indigo-900 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {track.cover_image_url ? (
                  <img src={track.cover_image_url} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-5 h-5 text-white/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate">{track.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge className={`text-xs border-0 ${STATUS_COLOR[track.status] || 'bg-muted text-muted-foreground'}`}>
                    {track.status}
                  </Badge>
                  {track.genre && <span className="text-xs text-muted-foreground capitalize">{track.genre}</span>}
                  <span className="text-xs text-muted-foreground">
                    {track.play_count || 0} plays · {track.like_count || 0} likes
                  </span>
                  {track.created_date && (
                    <span className="text-xs text-muted-foreground/70">
                      · {format(new Date(track.created_date), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {track.track_url && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyLink(track.track_url)}
                      className="h-8 w-8 rounded-lg"
                      title="Copy link"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </Button>
                    <a href={track.track_url} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" title="Open track">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}