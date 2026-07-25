import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Zap, Music, Radio, Star, Users, PlayCircle, Mic2 } from "lucide-react";

const EVENT_ICONS = {
  track_generated: { icon: Zap, color: "bg-cyan-500/20 text-cyan-400" },
  track_submitted: { icon: Music, color: "bg-purple-500/20 text-purple-400" },
  session_started: { icon: Radio, color: "bg-green-500/20 text-green-400" },
  session_completed: { icon: PlayCircle, color: "bg-blue-500/20 text-blue-400" },
  artist_followed: { icon: Users, color: "bg-pink-500/20 text-pink-400" },
  playlist_created: { icon: Music, color: "bg-indigo-500/20 text-indigo-400" },
  featured_artist: { icon: Star, color: "bg-yellow-500/20 text-yellow-400" },
  premiere_scheduled: { icon: Mic2, color: "bg-orange-500/20 text-orange-400" },
  new_member: { icon: Zap, color: "bg-emerald-500/20 text-emerald-400" },
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

export default function ActivityFeed({ limit = 10 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ActivityFeedItem.list("-created_date", limit)
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [limit]);

  if (loading) return (
    <div className="space-y-3">
      {Array(5).fill(0).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
    </div>
  );

  if (items.length === 0) return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p>No activity yet — be the first!</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const cfg = EVENT_ICONS[item.type] || { icon: Zap, color: "bg-muted text-muted-foreground" };
        const Icon = cfg.icon;
        return (
          <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
            <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors">
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${cfg.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {item.actor_name && (
                      <span className="font-semibold text-sm text-foreground">{item.actor_name} </span>
                    )}
                    <span className="text-sm text-muted-foreground">{item.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">{timeAgo(item.created_date)}</span>
                </div>
                {item.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>}
                {item.metadata?.model && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted/60 text-foreground/80 border border-border/40">
                    {item.metadata.model}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}