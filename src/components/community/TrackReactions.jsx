import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const EMOJIS = [
  { emoji: "🔥", label: "fire" },
  { emoji: "❤️", label: "heart" },
  { emoji: "🐐", label: "goat" },
  { emoji: "🤯", label: "mind_blown" },
  { emoji: "👏", label: "clap" },
];

export default function TrackReactions({ trackId, currentUser }) {
  const [reactions, setReactions] = useState([]);
  const [myReaction, setMyReaction] = useState(null);

  useEffect(() => {
    if (!trackId) return;
    base44.entities.Reaction.filter({ track_id: trackId })
      .then(data => {
        setReactions(data);
        if (currentUser) {
          setMyReaction(data.find(r => r.user_id === currentUser.id)?.emoji || null);
        }
      })
      .catch(() => {});
  }, [trackId, currentUser]);

  const counts = EMOJIS.reduce((acc, { label }) => {
    acc[label] = reactions.filter(r => r.emoji === label).length;
    return acc;
  }, {});

  const handleReact = async (emoji) => {
    if (!currentUser) { toast.error("Sign in to react"); return; }

    if (myReaction === emoji) {
      // Remove reaction
      const existing = reactions.find(r => r.user_id === currentUser.id && r.emoji === emoji);
      if (existing) {
        await base44.entities.Reaction.delete(existing.id);
        setReactions(prev => prev.filter(r => r.id !== existing.id));
        setMyReaction(null);
      }
    } else {
      // Remove old, add new
      const old = reactions.find(r => r.user_id === currentUser.id);
      if (old) {
        await base44.entities.Reaction.delete(old.id);
        setReactions(prev => prev.filter(r => r.id !== old.id));
      }
      const newReaction = await base44.entities.Reaction.create({
        track_id: trackId,
        user_id: currentUser.id,
        user_email: currentUser.email,
        emoji,
      });
      setReactions(prev => [...prev, newReaction]);
      setMyReaction(emoji);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {EMOJIS.map(({ emoji, label }) => (
        <button
          key={label}
          onClick={() => handleReact(label)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
            myReaction === label
              ? "bg-purple-600/30 border-purple-500 text-white"
              : "bg-muted/50 border-border text-muted-foreground hover:border-purple-500/50 hover:text-foreground"
          }`}
        >
          {emoji}
          {counts[label] > 0 && <span>{counts[label]}</span>}
        </button>
      ))}
    </div>
  );
}