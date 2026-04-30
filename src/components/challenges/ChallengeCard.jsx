import { motion } from "framer-motion";
import { Trophy, Clock, Users, ArrowRight, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_STYLES = {
  active: { badge: "bg-orange-500/20 text-orange-300 border-orange-500/30", label: "🔥 Active", glow: "hover:border-orange-500/40" },
  voting: { badge: "bg-purple-500/20 text-purple-300 border-purple-500/30", label: "🗳️ Voting Open", glow: "hover:border-purple-500/40" },
  upcoming: { badge: "bg-blue-500/20 text-blue-300 border-blue-500/30", label: "⏳ Coming Soon", glow: "hover:border-blue-500/40" },
  completed: { badge: "bg-green-500/20 text-green-300 border-green-500/30", label: "✅ Completed", glow: "hover:border-green-500/40" },
};

export default function ChallengeCard({ challenge, index, onSubmit, user }) {
  const style = STATUS_STYLES[challenge.status] || STATUS_STYLES.upcoming;
  const canSubmit = user && challenge.status === "active";

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
      className={`group relative p-6 rounded-3xl bg-card border border-border ${style.glow} transition-all flex flex-col`}>

      {challenge.cover_image_url && (
        <div className="w-full h-32 rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-pink-900 to-purple-900">
          <img src={challenge.cover_image_url} alt={challenge.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}

      {!challenge.cover_image_url && (
        <div className="w-full h-24 rounded-2xl mb-4 flex items-center justify-center bg-gradient-to-br from-pink-900/40 to-purple-900/40">
          <span className="text-5xl">{challenge.emoji || "🏆"}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <Badge className={`text-xs ${style.badge}`}>{style.label}</Badge>
        {challenge.type && <span className="text-xs text-muted-foreground capitalize">{challenge.type}</span>}
      </div>

      <h3 className="font-black text-foreground text-lg mb-2">{challenge.title}</h3>
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">{challenge.description}</p>

      {challenge.prompt && (
        <div className="p-3 rounded-xl bg-muted/60 border border-border mb-4">
          <p className="text-xs text-muted-foreground font-semibold mb-1">PROMPT</p>
          <p className="text-sm text-foreground">{challenge.prompt}</p>
        </div>
      )}

      {challenge.prize_description && (
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-400 font-semibold">{challenge.prize_description}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{challenge.submission_count || 0} entries</span>
        </div>
        {challenge.end_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Ends {new Date(challenge.end_date).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {canSubmit && (
        <Button onClick={onSubmit} className="mt-4 w-full rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold">
          <Flame className="w-4 h-4 mr-2" /> Submit Entry
        </Button>
      )}
    </motion.div>
  );
}