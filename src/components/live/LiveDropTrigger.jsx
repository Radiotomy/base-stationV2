import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Award, Gift, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * Phase 5 — Performer-side panel to trigger a live drop during a session.
 * Lists the creator's active collectibles. Hidden when no session/no isLive.
 */
export default function LiveDropTrigger({ sessionId, isLive, creatorId }) {
  const [collectibles, setCollectibles] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!creatorId) return;
    base44.functions.invoke('getCollectiblesForCreator', { creatorId })
      .then(r => setCollectibles(r.data?.data?.collectibles || []))
      .catch(() => {});
  }, [creatorId, sessionId]);

  const trigger = async (collectibleId) => {
    setBusyId(collectibleId);
    try {
      await base44.functions.invoke('triggerLiveDrop', { sessionId, collectibleId });
      toast.success('Live drop triggered!', { icon: '🎁' });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to trigger drop');
    } finally {
      setBusyId(null);
    }
  };

  if (!sessionId) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Gift className="w-4 h-4 text-yellow-400" />
        <h3 className="font-black text-foreground text-sm">Live Drops</h3>
      </div>

      {!isLive && (
        <p className="text-xs text-muted-foreground">Go live to drop collectibles to your audience.</p>
      )}

      {isLive && collectibles.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No collectibles yet. Create one in your <a href="/creator-dashboard" className="text-purple-400 underline">Creator Dashboard</a>.
        </p>
      )}

      {isLive && collectibles.length > 0 && (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {collectibles.map(c => (
            <button
              key={c.id}
              onClick={() => trigger(c.id)}
              disabled={busyId === c.id}
              className="w-full flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/30 hover:border-yellow-500/40 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center">
                {c.media_url
                  ? <img src={c.media_url} alt="" className="w-full h-full object-cover" />
                  : <Award className="w-3.5 h-3.5 text-white/60" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {c.supply ? `${c.claimed_count || 0}/${c.supply}` : `${c.claimed_count || 0} claimed`}
                </p>
              </div>
              {busyId === c.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-400" />
              ) : (
                <Gift className="w-3.5 h-3.5 text-yellow-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}