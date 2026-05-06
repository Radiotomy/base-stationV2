import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Phase 5 — Single fan club tier card.
 */
export default function TierCard({ tier, isCurrent, isBest, onJoin, disabled }) {
  return (
    <div className={`relative rounded-2xl border p-5 flex flex-col gap-3 transition-all
      ${isCurrent ? 'border-emerald-500 bg-emerald-500/5' : 'border-border bg-card hover:border-purple-500/40'}`}>
      {isBest && (
        <Badge className="absolute -top-2 left-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 text-[10px]">
          Most Popular
        </Badge>
      )}
      {isCurrent && (
        <Badge className="absolute -top-2 right-4 bg-emerald-500 text-white border-0 text-[10px]">
          Your Tier
        </Badge>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tier.color || '#a78bfa' }}>{tier.name}</p>
        <p className="text-3xl font-black text-foreground mt-1">${tier.price_usd}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
      </div>

      {tier.xp_multiplier > 1 && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Sparkles className="w-3.5 h-3.5" /> {tier.xp_multiplier}× XP Multiplier
        </div>
      )}

      <ul className="space-y-1.5 text-xs text-muted-foreground flex-1">
        {(tier.perks || []).map((p, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={() => onJoin?.(tier)}
        disabled={disabled || isCurrent}
        className="w-full rounded-xl font-bold text-sm"
        style={!isCurrent ? { background: tier.color || '#7c3aed' } : undefined}
        variant={isCurrent ? 'outline' : 'default'}
      >
        {isCurrent ? 'Active' : `Join ${tier.name}`}
      </Button>
    </div>
  );
}