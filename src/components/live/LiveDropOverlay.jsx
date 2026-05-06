import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Phase 5 — LiveWatch overlay that animates when a 'live-drop' event is on
 * the event bus. Auto-claims when the user clicks Claim.
 *
 * Props: { recentEvents, sessionId, currentUser }
 */
export default function LiveDropOverlay({ recentEvents = [], sessionId, currentUser }) {
  const [activeDrop, setActiveDrop] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    const drops = recentEvents.filter(e => e.type === 'live-drop');
    const latest = drops[drops.length - 1];
    if (latest && !dismissed.has(latest.id)) {
      setActiveDrop(latest);
      setClaimed(false);
    }
  }, [recentEvents]);

  const handleClaim = async () => {
    if (!currentUser) { base44.auth.redirectToLogin(); return; }
    setBusy(true);
    try {
      const r = await base44.functions.invoke('claimCollectible', {
        collectibleId: activeDrop.payload.collectible_id,
        source: 'live_drop',
        sessionId,
      });
      setClaimed(true);
      if (r.data?.already_claimed) toast.info('Already claimed');
      else toast.success(`Claimed! Edition #${r.data?.serial_number}`, { icon: '🏆' });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    if (activeDrop) setDismissed(prev => new Set(prev).add(activeDrop.id));
    setActiveDrop(null);
  };

  return (
    <AnimatePresence>
      {activeDrop && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50 max-w-xs bg-gradient-to-br from-purple-900 to-indigo-950 border border-purple-500/40 rounded-2xl p-4 shadow-2xl shadow-purple-500/30"
        >
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
              {activeDrop.payload?.media_url
                ? <img src={activeDrop.payload.media_url} alt="" className="w-full h-full object-cover" />
                : <Award className="w-6 h-6 text-yellow-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-yellow-300 uppercase tracking-wide">🎁 Live Drop</p>
              <p className="text-sm font-black text-white truncate">{activeDrop.payload?.name}</p>
              <p className="text-xs text-white/60 mt-0.5">
                {activeDrop.payload?.supply ? `Limited to ${activeDrop.payload.supply}` : 'Free claim'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleClaim}
              disabled={busy || claimed}
              className="flex-1 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs gap-1.5"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
               claimed ? <><Check className="w-3.5 h-3.5" /> Claimed</> :
               <><Award className="w-3.5 h-3.5" /> Claim</>}
            </Button>
            <Button onClick={dismiss} variant="ghost" className="rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/10">
              Dismiss
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}