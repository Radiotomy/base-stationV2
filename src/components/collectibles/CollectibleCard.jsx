import { useState } from 'react';
import { Award, Lock, Check, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Phase 5 — Collectible card.
 * Props: { collectible, claimed, onClaimed, sessionId? }
 */
export default function CollectibleCard({ collectible: c, claimed, onClaimed, sessionId }) {
  const [busy, setBusy] = useState(false);

  const supplyText = c.supply
    ? `${c.claimed_count || 0} / ${c.supply}`
    : `${c.claimed_count || 0} claimed`;
  const soldOut = c.supply && (c.claimed_count || 0) >= c.supply;

  const handleClaim = async () => {
    setBusy(true);
    try {
      const r = await base44.functions.invoke('claimCollectible', {
        collectibleId: c.id,
        source: sessionId ? 'live_drop' : c.claim_type,
        sessionId: sessionId || null,
      });
      if (r.data?.already_claimed) {
        toast.info('You already claimed this collectible');
      } else {
        toast.success(`Claimed! Edition #${r.data?.serial_number}`, { icon: '🏆' });
      }
      onClaimed?.(r.data?.data);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
      <div className="aspect-square bg-gradient-to-br from-purple-900 to-indigo-950 relative">
        {c.media_url ? (
          <img src={c.media_url} alt={c.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Award className="w-12 h-12 text-white/30" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge className="bg-black/60 text-white border-0 text-xs capitalize">{c.claim_type}</Badge>
          {c.audius_collectible_id && (
            <Badge className="bg-emerald-500/90 text-white border-0 text-xs">Audius</Badge>
          )}
        </div>
        {claimed && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-emerald-500/90 text-white border-0 text-xs gap-1">
              <Check className="w-3 h-3" /> Owned
            </Badge>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
        {c.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2">
          <span>{supplyText}</span>
          {c.price_usd != null && c.claim_type === 'purchase' && (
            <span className="font-bold text-foreground">${c.price_usd}</span>
          )}
        </div>

        {claimed ? (
          <Button disabled variant="outline" className="rounded-xl text-xs gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Claimed
          </Button>
        ) : soldOut ? (
          <Button disabled variant="outline" className="rounded-xl text-xs gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Sold Out
          </Button>
        ) : (
          <Button onClick={handleClaim} disabled={busy}
            className="rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
            {c.claim_type === 'purchase' ? `Buy $${c.price_usd}` : 'Claim'}
          </Button>
        )}
      </div>
    </div>
  );
}