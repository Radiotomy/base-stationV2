import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Flame, Clock, Plus, Music, CheckCircle, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import SubmitChallengeModal from "@/components/challenges/SubmitChallengeModal";

const STATUS_TABS = [
  { key: "active", label: "🔥 Active", color: "text-orange-400" },
  { key: "voting", label: "🗳️ Voting", color: "text-purple-400" },
  { key: "upcoming", label: "⏳ Upcoming", color: "text-blue-400" },
  { key: "completed", label: "✅ Completed", color: "text-green-400" },
];

export default function Challenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    setLoading(true);
    const data = await base44.entities.Challenge.list("-created_date", 50);
    setChallenges(data);
    setLoading(false);
  };

  const filtered = challenges.filter(c => c.status === tab);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-950 via-pink-900 to-purple-950 pt-20 pb-16 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-pink-500/20 via-transparent to-transparent" />
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 bg-pink-500/20 text-pink-300 border-pink-500/30 px-4 py-1.5 text-xs tracking-widest uppercase">
              🏆 Creator Challenges
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
              Compete &amp; <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Win</span>
            </h1>
            <p className="text-pink-200/70 text-lg max-w-xl mx-auto">
              Weekly and monthly challenges pushing AI music creativity to the next level. Submit your track, earn votes, claim glory.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Tabs */}
        <div className="flex gap-2 bg-muted/40 rounded-xl p-1 w-fit mb-10 flex-wrap">
          {STATUS_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? "bg-white dark:bg-zinc-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground border border-dashed border-border rounded-2xl">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No {tab} challenges right now</p>
            <p className="text-sm mt-1">Check back soon — new challenges drop every week!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((challenge, i) => (
              <ChallengeCard key={challenge.id} challenge={challenge} index={i}
                onSubmit={() => setSelectedChallenge(challenge)} user={user} />
            ))}
          </div>
        )}
      </div>

      {selectedChallenge && (
        <SubmitChallengeModal
          challenge={selectedChallenge}
          user={user}
          onClose={() => setSelectedChallenge(null)}
          onSubmitted={() => { setSelectedChallenge(null); loadChallenges(); }}
        />
      )}
    </div>
  );
}