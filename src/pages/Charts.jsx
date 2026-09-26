import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Play, Music, Flame, Calendar, Globe, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import AILabelBadge from "@/components/common/AILabelBadge";
import AudiusCrossLink from "@/components/audius/AudiusCrossLink";

const PERIODS = [
  { key: "weekly", label: "This Week", icon: Flame },
  { key: "monthly", label: "This Month", icon: Calendar },
  { key: "all-time", label: "All Time", icon: Globe },
];

const GENRES = ["all", "hip-hop", "edm", "pop", "r&b", "rock", "lo-fi", "jazz", "trap", "other"];
const MOODS = ["all", "Energetic", "Chill", "Dark", "Happy", "Uplifting", "Aggressive", "Romantic"];

export default function Charts() {
  const [tracks, setTracks] = useState([]);
  const [allTracks, setAllTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("weekly");
  const [genre, setGenre] = useState("all");
  const [mood, setMood] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCharts();
  }, [period, genre]);

  useEffect(() => {
    if (!search.trim() && mood === "all") {
      setTracks(allTracks);
      return;
    }
    let filtered = allTracks;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.track_title?.toLowerCase().includes(q) ||
        t.artist_name?.toLowerCase().includes(q)
      );
    }
    if (mood !== "all") {
      filtered = filtered.filter(t => t.tags?.includes(mood.toLowerCase()) || t.track_title?.toLowerCase().includes(mood.toLowerCase()));
    }
    setTracks(filtered);
  }, [search, mood, allTracks]);

  const loadCharts = async () => {
    setLoading(true);
    const query = { period };
    if (genre !== "all") query.genre = genre;
    const data = await base44.entities.TrackChart.filter(query, "-total_votes", 50);
    setAllTracks(data);
    setTracks(data);
    setLoading(false);
  };

  const rankColor = (rank) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-slate-300";
    if (rank === 3) return "text-amber-600";
    return "text-muted-foreground";
  };

  const RankChange = ({ change }) => {
    if (!change || change === 0) return <Minus className="w-3 h-3 text-muted-foreground" />;
    if (change > 0) return <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-bold"><TrendingUp className="w-3 h-3" />+{change}</span>;
    return <span className="flex items-center gap-0.5 text-red-400 text-xs font-bold"><TrendingDown className="w-3 h-3" />{change}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-950 via-red-900 to-pink-950 pt-20 pb-16 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-orange-500/20 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge className="mb-4 bg-orange-500/20 text-orange-300 border-orange-500/30 px-4 py-1.5 text-xs tracking-widest uppercase">
              🔥 Trending Charts
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
              What's <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-400">Hot</span>
            </h1>
            <p className="text-orange-200/70 text-lg max-w-xl mx-auto">
              Real-time rankings powered by community votes and plays. No algorithms, no label deals — pure talent.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Period Tabs */}
        <div className="flex gap-2 bg-muted/40 rounded-xl p-1 w-fit mb-6">
          {PERIODS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${period === key ? "bg-white dark:bg-zinc-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tracks or artists…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-input bg-card text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Genre Filter */}
        <div className="flex gap-2 flex-wrap mb-3">
          {GENRES.map(g => (
            <button key={g} onClick={() => setGenre(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${genre === g ? "bg-orange-600 border-orange-600 text-white" : "border-border text-muted-foreground hover:border-orange-500 hover:text-orange-400"}`}>
              {g}
            </button>
          ))}
        </div>

        {/* Mood Filter */}
        <div className="flex gap-2 flex-wrap mb-8">
          {MOODS.map(m => (
            <button key={m} onClick={() => setMood(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${mood === m ? "bg-purple-600 border-purple-600 text-white" : "border-border text-muted-foreground hover:border-purple-500 hover:text-purple-400"}`}>
              {m}
            </button>
          ))}
        </div>

        {/* Chart List */}
        {loading ? (
          <div className="space-y-3">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Music className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No chart data yet</p>
            <p className="text-sm mt-1">Start voting on tracks in sessions to build the charts!</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {tracks.map((track, i) => (
                <motion.div key={track.id}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.03 }}
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-orange-500/30 hover:bg-orange-500/5 transition-all cursor-pointer">
                  {/* Rank */}
                  <div className="w-10 text-center">
                    <span className={`text-2xl font-black ${rankColor(i + 1)}`}>{i + 1}</span>
                  </div>

                  {/* Cover */}
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-800 to-pink-900">
                    {track.cover_image_url ? (
                      <img src={track.cover_image_url} alt={track.track_title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-6 h-6 text-white/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-5 h-5 text-white" fill="white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate text-foreground">{track.track_title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{track.artist_name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <AILabelBadge label={track.ai_label} size="xs" />
                      <ProvenanceBadge origin={track.source || track.origin || 'community'} size="xs" />
                      {track.genre && <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize border-border">{track.genre}</Badge>}
                      <AudiusCrossLink trackId={track.audius_track_id} permalink={track.audius_permalink} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-orange-400">{track.total_votes?.toLocaleString() || 0} votes</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{track.total_plays?.toLocaleString() || 0} plays</div>
                  </div>

                  {/* Rank change */}
                  <div className="w-12 text-center flex-shrink-0">
                    <RankChange change={track.rank_change} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}