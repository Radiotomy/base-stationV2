import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Trophy, Star, Zap, TrendingUp, Crown, Medal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const PERIODS = [
  { key: "total_xp", label: "🏆 All Time" },
  { key: "weekly_xp", label: "⚡ This Week" },
  { key: "monthly_xp", label: "📅 This Month" },
];

const LEVEL_NAMES = ["", "Newcomer", "Rising Star", "Beatmaker", "Producer", "Hitmaker", "Visionary", "Legend", "Icon", "GOAT", "AI God"];

function xpToLevel(xp) {
  return Math.min(10, Math.floor(Math.sqrt(xp / 100)) + 1);
}

function RankIcon({ rank }) {
  if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-300" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-muted-foreground font-bold text-sm w-5 text-center">{rank}</span>;
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("total_xp");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    loadLeaders();
  }, [period]);

  const loadLeaders = async () => {
    setLoading(true);
    const data = await base44.entities.UserXP.list(`-${period}`, 50);
    setLeaders(data);
    setLoading(false);
  };

  const rarityColor = {
    common: "bg-slate-500/20 text-slate-300",
    rare: "bg-blue-500/20 text-blue-300",
    epic: "bg-purple-500/20 text-purple-300",
    legendary: "bg-yellow-500/20 text-yellow-300",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-yellow-950 via-amber-900 to-orange-950 pt-20 pb-16 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 bg-yellow-500/20 text-yellow-300 border-yellow-500/30 px-4 py-1.5 text-xs tracking-widest uppercase">
              🏆 Leaderboard
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
              Top <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">Creators</span>
            </h1>
            <p className="text-yellow-200/70 text-lg max-w-xl mx-auto">
              Earn XP by creating, competing, and engaging. Rise through the ranks to become an AIVTV Legend.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* XP Guide */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { action: "Submit a track", xp: "+50 XP" },
            { action: "Win a challenge", xp: "+500 XP" },
            { action: "Get a tip", xp: "+100 XP" },
            { action: "Gain a follower", xp: "+10 XP" },
          ].map(({ action, xp }) => (
            <div key={action} className="p-3 rounded-xl bg-card border border-border text-center">
              <p className="text-yellow-400 font-black text-sm">{xp}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action}</p>
            </div>
          ))}
        </div>

        {/* Period Tabs */}
        <div className="flex gap-2 bg-muted/40 rounded-xl p-1 w-fit mb-8">
          {PERIODS.map(({ key, label }) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${period === key ? "bg-white dark:bg-zinc-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="space-y-3">
            {Array(10).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-2xl">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No leaderboard data yet — start creating to earn XP!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaders.map((entry, i) => {
              const level = xpToLevel(entry.total_xp || 0);
              const levelName = LEVEL_NAMES[level] || "Creator";
              const isMe = currentUser && entry.user_email === currentUser.email;
              return (
                <motion.div key={entry.id}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isMe ? "bg-yellow-500/10 border-yellow-500/40" : "bg-card border-border hover:border-yellow-500/20"}`}>
                  {/* Rank */}
                  <div className="w-8 flex justify-center flex-shrink-0">
                    <RankIcon rank={i + 1} />
                  </div>

                  {/* Avatar */}
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-sm font-bold">
                      {(entry.user_name || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-foreground truncate">{entry.user_name || "Anonymous"}</p>
                      {isMe && <Badge className="text-xs bg-yellow-500/20 text-yellow-300 border-yellow-500/30">You</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">Lvl {level} · {levelName}</p>
                  </div>

                  {/* Stats */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-yellow-400 text-sm">{(entry[period] || 0).toLocaleString()} XP</p>
                    <div className="flex items-center gap-2 justify-end mt-0.5">
                      <span className="text-xs text-muted-foreground">{entry.badge_count || 0} badges</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{entry.challenges_won || 0} wins</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}