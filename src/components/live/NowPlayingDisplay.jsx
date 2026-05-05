import { Music2, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Audience-facing now-playing display — reads from session.state.nowPlaying.
 */
export default function NowPlayingDisplay({ nowPlaying, isLive }) {
  const { title, isPlaying } = nowPlaying || {};

  return (
    <AnimatePresence mode="wait">
      {title ? (
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="flex items-center gap-3 px-4 py-3 bg-card/80 backdrop-blur rounded-2xl border border-border"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center flex-shrink-0">
            <Music2 className="w-5 h-5 text-white/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground truncate">{title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isPlaying && isLive ? (
                <>
                  <Volume2 className="w-3 h-3 text-red-400 animate-pulse" />
                  <p className="text-xs text-red-400 font-semibold">Playing live</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Paused</p>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-2xl border border-dashed border-border"
        >
          <Music2 className="w-5 h-5 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            {isLive ? 'Waiting for performer to start…' : 'No track playing'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}