import { motion, AnimatePresence } from 'framer-motion';

const EVENT_LABELS = {
  join: { emoji: '👋', label: 'joined' },
  leave: { emoji: '🚪', label: 'left' },
  play: { emoji: '▶️', label: 'started playing' },
  pause: { emoji: '⏸️', label: 'paused' },
  seek: { emoji: '⏩', label: 'seeked' },
  reaction: { emoji: '🔥', label: 'reacted' },
  chat: { emoji: '💬', label: 'chatted' },
  'performer-ready': { emoji: '🎤', label: 'performer ready' },
  'performer-start': { emoji: '🚀', label: 'performance started' },
  'scene-change': { emoji: '🌐', label: 'scene changed' },
  'ai-action': { emoji: '🤖', label: 'AI action' },
  'fan-xp': { emoji: '⭐', label: 'XP earned' },
};

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

export default function EventFeed({ events = [] }) {
  // Phase 5.5 — guard against malformed/duplicate events
  const safe = (Array.isArray(events) ? events : []).filter(e => e && e.type && e.id);
  const seen = new Set();
  const deduped = [];
  for (const e of safe) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    deduped.push(e);
  }
  const visible = [...deduped].reverse().slice(0, 10);
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {visible.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No events yet</p>
      )}
      <AnimatePresence initial={false}>
        {visible.map((evt) => {
          const meta = EVENT_LABELS[evt.type] || { emoji: '📡', label: evt.type };
          return (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 py-1 px-2 rounded-lg bg-muted/30 text-xs"
            >
              <span>{meta.emoji}</span>
              <span className="text-muted-foreground font-mono">{formatTime(evt.timestamp)}</span>
              <span className="text-foreground/80 font-semibold capitalize">{meta.label}</span>
              {evt.payload?.title && (
                <span className="text-muted-foreground truncate">— {evt.payload.title}</span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}