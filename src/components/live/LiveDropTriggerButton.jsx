import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

/**
 * Phase 5 — Trigger Live Drop from inside LiveStudio.
 * Lists active collectibles for the current creator.
 */
export default function LiveDropTriggerButton({ sessionId, creatorId }) {
  const [open, setOpen] = useState(false);
  const [collectibles, setCollectibles] = useState([]);
  const [triggering, setTriggering] = useState(null);

  useEffect(() => {
    if (!open || !creatorId) return;
    base44.functions.invoke('getCollectiblesForCreator', { creatorId })
      .then(r => setCollectibles(r?.data?.data?.collectibles || r?.data?.collectibles || []))
      .catch(() => setCollectibles([]));
  }, [open, creatorId]);

  const trigger = async (c) => {
    setTriggering(c.id);
    try {
      await base44.functions.invoke('triggerLiveDrop', { sessionId, collectibleId: c.id });
      toast.success(`Dropped: ${c.name}`, { icon: '🎁' });
      setOpen(false);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Drop failed');
    } finally {
      setTriggering(null);
    }
  };

  if (!sessionId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-lg gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
          <Sparkles className="w-3.5 h-3.5" /> Trigger Live Drop
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Trigger a Live Drop</DialogTitle></DialogHeader>
        {collectibles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No active collectibles. Create one in your Creator Store first.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {collectibles.map(c => {
              const supplyLeft = c.supply != null ? Math.max(0, c.supply - (c.claimed_count || 0)) : null;
              return (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/20">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-purple-700 to-pink-700 flex-shrink-0">
                    {c.media_url && <img src={c.media_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {supplyLeft != null ? `${supplyLeft} left` : 'Unlimited'} · {c.origin}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => trigger(c)} disabled={triggering === c.id || supplyLeft === 0}
                    className="rounded-lg bg-amber-500 hover:bg-amber-400 text-black gap-1">
                    {triggering === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Drop
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}