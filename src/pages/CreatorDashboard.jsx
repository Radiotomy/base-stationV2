import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3, Music, Zap, DollarSign, TrendingUp, Eye, Heart,
  Download, Trash2, Edit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl bg-card border border-border space-y-2"
    >
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

export default function CreatorDashboard() {
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.TrackSubmission.filter({ artist_id: "current_user" }, "-created_date", 100),
      base44.entities.UserCredit.filter({}, "-created_date", 1),
    ])
      .then(([authUser, userTracks, creditData]) => {
        if (!authUser?.is_creator) {
          navigate("/");
          return;
        }
        setUser(authUser);
        setTracks(userTracks);
        setStats({
          total_tracks: userTracks.length,
          published: userTracks.filter(t => t.status === "approved").length,
          drafts: userTracks.filter(t => t.status === "pending").length,
          total_plays: userTracks.reduce((sum, t) => sum + (t.play_count || 0), 0),
          total_likes: userTracks.reduce((sum, t) => sum + (t.like_count || 0), 0),
          revenue_cents: creditData[0]?.tips_received_cents || 0,
        });
        setLoading(false);
      })
      .catch(() => navigate("/"));
  }, [navigate]);

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
      {/* Hero */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-foreground mb-2">
          🎵 Studio Dashboard
        </h1>
        <p className="text-muted-foreground">Manage your tracks, analytics, and earnings.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
        <StatCard
          icon={Music}
          label="Total Tracks"
          value={stats.total_tracks}
          color="bg-purple-600"
        />
        <StatCard
          icon={Zap}
          label="Published"
          value={stats.published}
          color="bg-emerald-600"
        />
        <StatCard
          icon={Edit}
          label="Drafts"
          value={stats.drafts}
          color="bg-blue-600"
        />
        <StatCard
          icon={Eye}
          label="Total Plays"
          value={stats.total_plays.toLocaleString()}
          color="bg-orange-600"
        />
        <StatCard
          icon={Heart}
          label="Total Likes"
          value={stats.total_likes.toLocaleString()}
          color="bg-pink-600"
        />
        <StatCard
          icon={DollarSign}
          label="Revenue"
          value={`$${(stats.revenue_cents / 100).toFixed(2)}`}
          color="bg-yellow-600"
        />
      </div>

      {/* Creation Shortcuts */}
      <div className="mb-12">
        <h2 className="text-xl font-black text-foreground mb-4">Quick Create</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: "/lyrics-studio", label: "🎤 Write Lyrics", color: "from-pink-600 to-rose-600" },
            { to: "/music-studio", label: "🎵 Generate Music", color: "from-blue-600 to-cyan-600" },
            { to: "/video-studio", label: "🎬 Create Video", color: "from-indigo-600 to-purple-600" },
            { to: "/submit", label: "📤 Submit Track", color: "from-emerald-600 to-teal-600" },
          ].map(({ to, label, color }) => (
            <Button
              key={to}
              onClick={() => navigate(to)}
              className={`bg-gradient-to-r ${color} text-white font-bold rounded-xl py-6 h-auto flex flex-col gap-1`}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tracks Library */}
      <div>
        <h2 className="text-xl font-black text-foreground mb-4">📚 Your Library</h2>
        {tracks.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <Music className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">No tracks yet. Create your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tracks.map((track) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-card border border-border hover:border-purple-500/30 hover:bg-purple-500/5 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-800 to-indigo-900 flex-shrink-0 flex items-center justify-center">
                    <Music className="w-5 h-5 text-white/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{track.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs ${
                        track.status === "approved"
                          ? "bg-emerald-500/20 text-emerald-400 border-0"
                          : track.status === "rejected"
                          ? "bg-destructive/20 text-destructive border-0"
                          : "bg-yellow-500/20 text-yellow-400 border-0"
                      }`}>
                        {track.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {track.play_count || 0} plays · {track.like_count || 0} likes
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}