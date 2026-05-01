import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Award, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const RARITY_STYLES = {
  common: { border: "border-slate-600", bg: "bg-slate-800/50", label: "text-slate-400", glow: "" },
  rare: { border: "border-blue-500/50", bg: "bg-blue-900/30", label: "text-blue-400", glow: "shadow-blue-500/20" },
  epic: { border: "border-purple-500/50", bg: "bg-purple-900/30", label: "text-purple-400", glow: "shadow-purple-500/20" },
  legendary: { border: "border-yellow-500/60", bg: "bg-yellow-900/20", label: "text-yellow-400", glow: "shadow-yellow-500/30 shadow-lg" },
};

const CATEGORY_FILTERS = ["all", "creator", "community", "challenge", "milestone", "special", "fan"];

const FAN_BADGE_SHOWCASE = [
  { emoji: "🎧", name: "First Listener", desc: "Follow your first artist", rarity: "common", xp: 50 },
  { emoji: "💬", name: "Voice of the Crowd", desc: "Leave 10 track comments", rarity: "common", xp: 100 },
  { emoji: "🔥", name: "Hype Machine", desc: "React to 50 tracks", rarity: "rare", xp: 250 },
  { emoji: "🐐", name: "Superfan", desc: "Follow 10 artists & comment 50×", rarity: "epic", xp: 500 },
  { emoji: "👑", name: "Community Pillar", desc: "Top fan of 3 different artists", rarity: "legendary", xp: 1000 },
  { emoji: "💸", name: "Tip Legend", desc: "Tip 5 artists", rarity: "rare", xp: 300 },
  { emoji: "📻", name: "Radio Head", desc: "Listen to 20+ radio sessions", rarity: "common", xp: 150 },
  { emoji: "🗳️", name: "Chart Maker", desc: "Vote on 25 tracks", rarity: "rare", xp: 200 },
];

export default function Badges() {
  const [allBadges, setAllBadges] = useState([]);
  const [myBadges, setMyBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);
      const [badges, userBadges] = await Promise.all([
        base44.entities.Badge.filter({ is_active: true }, "category", 100),
        u ? base44.entities.UserBadge.filter({ user_id: u.id }, "-created_date", 100) : Promise.resolve([]),
      ]);
      setAllBadges(badges);
      setMyBadges(userBadges);
      setLoading(false);
    };
    load();
  }, []);

  const myBadgeIds = new Set(myBadges.map(b => b.badge_id));
  const filtered = allBadges.filter(b => category === "all" || b.category === category);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-violet-900 to-purple-950 pt-20 pb-16 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-violet-500/20 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 bg-violet-500/20 text-violet-300 border-violet-500/30 px-4 py-1.5 text-xs tracking-widest uppercase">
              🏅 Badge Collection
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
              Earn Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400">Badges</span>
            </h1>
            <p className="text-violet-200/70 text-lg max-w-xl mx-auto">
              Unlock badges by creating music, winning challenges, and building your community. Rare badges flex your status.
            </p>
            {user && (
              <div className="mt-6 inline-flex items-center gap-2 bg-white/10 rounded-full px-5 py-2.5 text-white text-sm font-semibold">
                <Award className="w-4 h-4 text-yellow-400" />
                You have {myBadges.length} badge{myBadges.length !== 1 ? "s" : ""}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Category filter */}
        <div className="flex gap-2 flex-wrap mb-8">
          {CATEGORY_FILTERS.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${category === c ? "bg-violet-600 border-violet-600 text-white" : "border-border text-muted-foreground hover:border-violet-500 hover:text-violet-400"}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Fan Badge Showcase */}
        {(category === "all" || category === "fan") && (
          <div className="mb-10">
            <h2 className="text-lg font-black text-foreground mb-1 flex items-center gap-2">🎧 Fan Badges</h2>
            <p className="text-xs text-muted-foreground mb-4">Earned by being an active listener & community member — no music creation needed.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {FAN_BADGE_SHOWCASE.map((badge, i) => {
                const style = RARITY_STYLES[badge.rarity] || RARITY_STYLES.common;
                return (
                  <motion.div key={badge.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                    className={`relative p-4 rounded-2xl border ${style.border} ${style.bg} ${style.glow} flex flex-col items-center text-center`}>
                    <div className="text-4xl mb-3">{badge.emoji}</div>
                    <p className={`text-xs font-bold ${style.label}`}>{badge.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-tight">{badge.desc}</p>
                    <div className={`mt-2 text-xs font-semibold capitalize ${style.label}`}>{badge.rarity}</div>
                    <div className="text-xs text-yellow-400 mt-1">+{badge.xp} XP</div>
                    <div className="absolute top-2 right-2">
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array(15).fill(0).map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((badge, i) => {
              const earned = myBadgeIds.has(badge.id);
              const style = RARITY_STYLES[badge.rarity] || RARITY_STYLES.common;
              return (
                <motion.div key={badge.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                  className={`relative p-4 rounded-2xl border ${style.border} ${style.bg} ${style.glow} flex flex-col items-center text-center transition-all ${!earned ? "opacity-40 grayscale" : ""}`}>
                  <div className="text-4xl mb-3">{badge.emoji}</div>
                  <p className={`text-xs font-bold ${earned ? style.label : "text-muted-foreground"}`}>{badge.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-tight">{badge.requirement_description}</p>
                  <div className={`mt-2 text-xs font-semibold capitalize ${style.label}`}>{badge.rarity}</div>
                  {badge.xp_reward > 0 && <div className="text-xs text-yellow-400 mt-1">+{badge.xp_reward} XP</div>}
                  {!earned && (
                    <div className="absolute top-2 right-2">
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}