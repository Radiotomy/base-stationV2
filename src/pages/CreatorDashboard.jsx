import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3, Music, Zap, TrendingUp, Eye, Heart,
  Trash2, Image, FileText, Film,
  Plus, ExternalLink, Clock, CheckCircle, Folder, History, RefreshCw, BarChart2
} from "lucide-react";
import CreditBalanceWidget from "@/components/credits/CreditBalanceWidget";
import XPWidget from "@/components/dashboard/XPWidget";
import ProjectsTab from "@/components/dashboard/ProjectsTab";
import GenerationHistoryTab from "@/components/dashboard/GenerationHistoryTab";
import UsageAnalytics from "@/components/dashboard/UsageAnalytics";
import TrackCard from "@/components/dashboard/TrackCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUS_COLOR = {
  approved: "bg-emerald-500/20 text-emerald-400",
  pending:  "bg-yellow-500/20 text-yellow-400",
  rejected: "bg-destructive/20 text-destructive",
};

const ASSET_ICONS = {
  track:    { icon: Music,    color: "from-blue-600 to-cyan-700" },
  lyric:    { icon: FileText, color: "from-pink-600 to-rose-700" },
  coverart: { icon: Image,    color: "from-purple-600 to-violet-700" },
  project:  { icon: Film,     color: "from-indigo-600 to-purple-700" },
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl bg-card border border-border space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-semibold">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
    </motion.div>
  );
}

function AssetCard({ asset, onDelete }) {
  const { icon: Icon, color } = ASSET_ICONS[asset.asset_type] || ASSET_ICONS.track;
  const isTrack = asset.asset_type === 'track';
  const [audioError, setAudioError] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-card border border-border hover:border-purple-500/30 transition-all group">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex-shrink-0 flex items-center justify-center overflow-hidden`}>
          {asset.thumbnail_url
            ? <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover" />
            : <Icon className="w-5 h-5 text-white/70" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground truncate">{asset.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-xs capitalize px-1.5 py-0">{asset.asset_type}</Badge>
            {asset.metadata?.genre && <span className="text-xs text-muted-foreground capitalize">{asset.metadata.genre}</span>}
            {asset.metadata?.bpm && <span className="text-xs text-muted-foreground">{asset.metadata.bpm} BPM</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {asset.file_url && (
            <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(asset.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {isTrack && asset.file_url && !audioError && (
        <audio controls className="w-full mt-3 rounded-xl h-9" src={asset.file_url}
          onError={() => setAudioError(true)} />
      )}
    </motion.div>
  );
}

export default function CreatorDashboard() {
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [assets, setAssets] = useState([]);
  const [activeTab, setActiveTab] = useState("library");
  const [stats, setStats] = useState(null);
  const [usageLogs, setUsageLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assetFilter, setAssetFilter] = useState("all");
  const navigate = useNavigate();

  const loadData = useCallback(async (userId) => {
    const [userTracks, userAssets, logs] = await Promise.all([
      base44.entities.TrackSubmission.filter({ artist_id: userId }, "-created_date", 50),
      base44.entities.UserAsset.filter({ user_id: userId }, "-created_date", 100),
      base44.entities.APIUsageLog.filter({ user_id: userId }, "-created_date", 200).catch(() => []),
    ]);
    setTracks(userTracks);
    setAssets(userAssets);
    setUsageLogs(logs);
    const creditsSpent = logs.reduce((s, l) => s + (l.credits_used || 0), 0);
    const totalGenerations = logs.filter(l => l.status === 'success').length;
    setStats({
      total_tracks: userTracks.length,
      published: userTracks.filter(t => t.status === "approved").length,
      pending: userTracks.filter(t => t.status === "pending").length,
      total_plays: userTracks.reduce((s, t) => s + (t.play_count || 0), 0),
      total_likes: userTracks.reduce((s, t) => s + (t.like_count || 0), 0),
      total_assets: userAssets.length,
      credits_spent: creditsSpent,
      total_generations: totalGenerations,
    });
  }, []);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u) { navigate("/"); return; }
      setUser(u);
      loadData(u.id).finally(() => setLoading(false));
    }).catch(() => navigate("/"));
  }, [navigate, loadData]);

  // Real-time subscription to asset changes
  useEffect(() => {
    if (!user) return;
    const unsub = base44.entities.UserAsset.subscribe((event) => {
      if (event.type === 'create' && event.data?.user_id === user.id) {
        setAssets(prev => [event.data, ...prev]);
        setStats(s => s ? { ...s, total_assets: s.total_assets + 1 } : s);
      } else if (event.type === 'delete') {
        setAssets(prev => prev.filter(a => a.id !== event.id));
        setStats(s => s ? { ...s, total_assets: Math.max(0, s.total_assets - 1) } : s);
      } else if (event.type === 'update' && event.data?.user_id === user.id) {
        setAssets(prev => prev.map(a => a.id === event.id ? event.data : a));
      }
    });
    return unsub;
  }, [user]);

  const deleteAsset = async (id) => {
    await base44.entities.UserAsset.delete(id);
    toast.success("Asset deleted");
  };

  const assetsByType = {
    all:      assets,
    track:    assets.filter(a => a.asset_type === "track"),
    lyric:    assets.filter(a => a.asset_type === "lyric"),
    coverart: assets.filter(a => a.asset_type === "coverart"),
  };

  const TABS = [
    { key: "library",   label: `📂 Library (${assets.length})` },
    { key: "projects",  label: "🗂️ Projects" },
    { key: "tracks",    label: `📤 Submissions (${tracks.length})` },
    { key: "history",   label: "🕐 History" },
    { key: "analytics", label: "📊 Analytics" },
  ];

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
      {/* Hero */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground mb-2">🎵 Studio Dashboard</h1>
          <p className="text-muted-foreground">Your tracks, assets, projects & generation history.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <CreditBalanceWidget />
          <Link to="/credits">
            <Button variant="outline" className="rounded-xl gap-2 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10 text-sm">
              <Zap className="w-4 h-4" /> Get Credits
            </Button>
          </Link>
          <Button onClick={() => user && loadData(user.id)} variant="ghost" size="icon" className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* XP Widget */}
      {user && <div className="mb-8"><XPWidget userId={user.id} /></div>}

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <StatCard icon={Music}       label="Submitted"    value={stats.total_tracks}                color="bg-purple-600" />
          <StatCard icon={CheckCircle} label="Published"    value={stats.published}                    color="bg-emerald-600" />
          <StatCard icon={Clock}       label="Pending"      value={stats.pending}                      color="bg-yellow-600" />
          <StatCard icon={Eye}         label="Total Plays"  value={stats.total_plays.toLocaleString()}  color="bg-orange-600" />
          <StatCard icon={Heart}       label="Likes"        value={stats.total_likes.toLocaleString()}  color="bg-pink-600" />
          <StatCard icon={Folder}      label="Assets"       value={stats.total_assets}                  color="bg-blue-600" />
          <StatCard icon={Zap}         label="Generated"    value={stats.total_generations}             color="bg-cyan-600" />
          <StatCard icon={TrendingUp}  label="Credits Used" value={stats.credits_spent}                 color="bg-amber-600" />
        </div>
      )}

      {/* Quick Create */}
      <div className="mb-8">
        <h2 className="text-lg font-black text-foreground mb-4">Quick Create</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { to: "/lyrics-studio",       label: "🎤 Lyrics",    color: "from-pink-600 to-rose-600" },
            { to: "/music-studio",        label: "🎵 Music",     color: "from-blue-600 to-cyan-600" },
            { to: "/cover-art-studio",    label: "🎨 Cover Art", color: "from-purple-600 to-violet-600" },
            { to: "/video-studio",        label: "🎬 Video",     color: "from-indigo-600 to-purple-600" },
            { to: "/audio-remix-studio",  label: "🎛️ Remix",     color: "from-teal-600 to-cyan-600" },
            { to: "/social-automation",   label: "📱 Social",    color: "from-pink-600 to-orange-600" },
          ].map(({ to, label, color }) => (
            <Link key={to} to={to}
              className={`bg-gradient-to-r ${color} text-white font-bold rounded-xl py-3 text-center text-sm hover:opacity-90 transition-opacity`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${activeTab === key ? "border-purple-500 text-purple-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Asset Library Tab */}
      {activeTab === "library" && (
        <div>
          <div className="flex gap-2 mb-5 flex-wrap">
            {[
              { key: "all",      label: `All (${assets.length})` },
              { key: "track",    label: `🎵 Tracks (${assetsByType.track.length})` },
              { key: "lyric",    label: `📝 Lyrics (${assetsByType.lyric.length})` },
              { key: "coverart", label: `🎨 Cover Art (${assetsByType.coverart.length})` },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setAssetFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${assetFilter === key ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {label}
              </button>
            ))}
          </div>
          {(assetsByType[assetFilter] || []).length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-2xl">
              <Folder className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">No assets yet — generate something in the studios!</p>
              <Link to="/music-studio" className="text-purple-400 text-xs hover:text-purple-300 mt-2 block">Go to Music Studio →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {(assetsByType[assetFilter] || []).map(asset => (
                <TrackCard key={asset.id} asset={asset} onDelete={deleteAsset} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === "projects" && user && (
        <ProjectsTab userId={user.id} assets={assets} />
      )}

      {/* Submissions Tab */}
      {activeTab === "tracks" && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-muted-foreground">{tracks.length} track{tracks.length !== 1 ? "s" : ""} submitted</p>
            <Link to="/submit">
              <Button className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-500 text-sm font-bold">
                <Plus className="w-4 h-4" /> Submit New Track
              </Button>
            </Link>
          </div>
          {tracks.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-2xl">
              <Music className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">No tracks submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tracks.map(track => (
                <motion.div key={track.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-card border border-border hover:border-purple-500/30 transition-all flex items-center gap-4 group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-800 to-indigo-900 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {track.cover_image_url
                      ? <img src={track.cover_image_url} alt={track.title} className="w-full h-full object-cover" />
                      : <Music className="w-5 h-5 text-white/30" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{track.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`text-xs border-0 ${STATUS_COLOR[track.status] || "bg-muted text-muted-foreground"}`}>
                        {track.status}
                      </Badge>
                      {track.genre && <span className="text-xs text-muted-foreground capitalize">{track.genre}</span>}
                      <span className="text-xs text-muted-foreground">{track.play_count || 0} plays · {track.like_count || 0} likes</span>
                    </div>
                  </div>
                  {track.track_url && (
                    <a href={track.track_url} target="_blank" rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generation History Tab */}
      {activeTab === "history" && user && (
        <GenerationHistoryTab userId={user.id} />
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && user && (
        <UsageAnalytics userId={user.id} />
      )}
    </div>
  );
}