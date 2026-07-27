import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Zap, Music, Radio, PlayCircle, Users } from "lucide-react";

const EVENT_ICONS = {
  track_generated: { icon: Zap, color: "bg-cyan-500/20 text-cyan-400" },
  loop_generated: { icon: Music, color: "bg-teal-500/20 text-teal-400" },
  track_submitted: { icon: Music, color: "bg-purple-500/20 text-purple-400" },
  session_started: { icon: Radio, color: "bg-green-500/20 text-green-400" },
  session_completed: { icon: PlayCircle, color: "bg-blue-500/20 text-blue-400" },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Personalized activity feed — only shows updates from artists the user follows
 * (new tracks, loops, live sessions), unlike the global ActivityFeed on Home.
 */
export default function FollowingFeed({ follows }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = (follows || []).map(f => f.following_id).filter(Boolean);
    if (ids.length === 0) { setLoading(false); return; }
    base44.entities.ActivityFeedItem.filter({ actor_id: { $in: ids } }, "-created_date", 20)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [follows]);

  if (loading) return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
      {Array(3).fill(0).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
    </div>
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-[#FF9A4D]" />
        <h3 className="font-black text-sm">Following Feed</h3>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Zap className="w-7 h-7 mx-auto mb-2 opacity-30" />
          <p>No updates yet from artists you follow.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const cfg = EVENT_ICONS[item.type] || { icon: Zap, color: "bg-muted text-muted-foreground" };
            const Icon = cfg.icon;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors">
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm">
                      {item.actor_name && <span className="font-semibold text-foreground">{item.actor_name} </span>}
                      <span className="text-muted-foreground">{item.title}</span>
                    </p>
                    <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">{timeAgo(item.created_date)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}