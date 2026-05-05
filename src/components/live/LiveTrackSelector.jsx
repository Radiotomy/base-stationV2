import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Music2, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Dropdown selector for picking a track from the user's UserAsset library.
 * Calls onSelect(asset) when a track is chosen.
 */
export default function LiveTrackSelector({ onSelect, selectedTrack, disabled }) {
  const [assets, setAssets] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    base44.auth.me().then(user => {
      base44.entities.UserAsset.filter({ user_id: user.id, asset_type: 'track' }, '-created_date', 30)
        .then(setAssets)
        .catch(() => {})
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  const choose = (asset) => {
    onSelect(asset);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        disabled={disabled}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-all disabled:opacity-50 text-left"
      >
        <Music2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {selectedTrack ? (
            <p className="text-sm font-semibold text-foreground truncate">{selectedTrack.title}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading library…' : 'Pick a track from your library'}
            </p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
          >
            {assets.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No tracks in library yet. Generate one in Music Studio first.
              </div>
            ) : (
              assets.map(asset => (
                <button key={asset.id} onClick={() => choose(asset)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50 last:border-0">
                  {asset.thumbnail_url ? (
                    <img src={asset.thumbnail_url} alt={asset.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center flex-shrink-0">
                      <Music2 className="w-3.5 h-3.5 text-white/60" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{asset.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[asset.metadata?.genre, asset.metadata?.bpm && `${asset.metadata.bpm} BPM`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {selectedTrack?.id === asset.id && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}