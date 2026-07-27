import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const REACTIONS = [
  { emoji: '🔥', label: 'fire' },
  { emoji: '❤️', label: 'heart' },
  { emoji: '🐐', label: 'goat' },
  { emoji: '🤯', label: 'mind_blown' },
  { emoji: '👏', label: 'clap' },
];

const SESSION_XP_CAP = 20;
const XP_PER_REACTION = 2;

/**
 * Reaction bar with floating emoji burst animation and XP cap per session.
 * Persists reactions to LiveChatMessage entity so they show in chat panel.
 */
export default function LiveReactionBar({ sessionId, currentUser, isLive }) {
  const [counts, setCounts] = useState({ fire: 0, heart: 0, goat: 0, mind_blown: 0, clap: 0 });
  const [sessionXP, setSessionXP] = useState(0);
  const [floaters, setFloaters] = useState([]); // { id, emoji, x }

  // Subscribe to reactions from other users (skip our own — applied optimistically on send)
  useEffect(() => {
    if (!sessionId) return;
    const unsub = base44.entities.LiveChatMessage.subscribe(evt => {
      if (evt.type === 'create' && evt.data?.session_id === sessionId && evt.data?.type === 'reaction') {
        if (evt.data.user_id === currentUser?.id) return;
        const label = REACTIONS.find(r => r.emoji === evt.data.emoji)?.label;
        if (label) {
          setCounts(prev => ({ ...prev, [label]: (prev[label] || 0) + 1 }));
          spawnFloater(evt.data.emoji);
        }
      }
    });
    return unsub;
  }, [sessionId, currentUser?.id]);

  const spawnFloater = (emoji) => {
    const id = Date.now() + Math.random();
    const x = 10 + Math.random() * 80; // random horizontal %
    setFloaters(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== id)), 1800);
  };

  const react = async (reaction) => {
    if (!currentUser) { toast.error('Sign in to react'); return; }
    if (!isLive) return;
    if (sessionXP >= SESSION_XP_CAP) {
      toast('Max reactions reached for this session 🎉', { icon: '⚡' });
      return;
    }

    // Optimistic local update
    setCounts(prev => ({ ...prev, [reaction.label]: (prev[reaction.label] || 0) + 1 }));
    setSessionXP(prev => prev + XP_PER_REACTION);
    spawnFloater(reaction.emoji);

    await base44.entities.LiveChatMessage.create({
      session_id: sessionId,
      user_id: currentUser.id,
      user_name: currentUser.full_name || 'Listener',
      user_email: currentUser.email,
      message: reaction.emoji,
      type: 'reaction',
      emoji: reaction.emoji,
    });

    // Award XP (server-enforces session cap)
    base44.functions.invoke('awardLiveXP', { sessionId, kind: 'reaction' })
      .then(r => {
        if (r.data?.new_badges?.length) {
          r.data.new_badges.forEach(b => toast.success(`🏆 Badge unlocked: ${b.replace(/_/g, ' ')}`));
        }
      }).catch(() => {});
  };

  const xpPct = Math.min(100, (sessionXP / SESSION_XP_CAP) * 100);

  return (
    <div className="relative bg-card rounded-2xl border border-border p-4 space-y-3">
      {/* Floating emoji animations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        <AnimatePresence>
          {floaters.map(f => (
            <motion.span key={f.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -80, scale: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: 'easeOut' }}
              style={{ left: `${f.x}%`, bottom: '20px', position: 'absolute' }}
              className="text-2xl select-none"
            >
              {f.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase">Reactions</p>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="text-xs text-yellow-400 font-bold">{sessionXP}/{SESSION_XP_CAP} XP</span>
        </div>
      </div>

      <div className="flex gap-2">
        {REACTIONS.map(r => (
          <button key={r.label} onClick={() => react(r)}
            disabled={!isLive || !currentUser}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl bg-muted/50 hover:bg-muted disabled:opacity-40 transition-all active:scale-90 group">
            <span className="text-xl group-hover:scale-110 transition-transform">{r.emoji}</span>
            <span className="text-xs font-bold text-muted-foreground">{counts[r.label] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}