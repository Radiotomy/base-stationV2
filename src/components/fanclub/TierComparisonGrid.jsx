import { Check, Sparkles, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Phase 5 — Tier comparison grid for a fan club.
 *
 * Props:
 *   - tiers: array of tier objects
 *   - activeTierId: id of the user's current tier (highlighted)
 *   - onJoin: (tierId) => void
 *   - busyTierId: tier currently being joined
 *   - disabled: boolean (e.g. creator viewing own club)
 */
export default function TierComparisonGrid({ tiers = [], activeTierId, onJoin, busyTierId, disabled }) {
  if (!tiers.length) {
    return (
      <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-2xl">
        No tiers yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {tiers.map((tier, idx) => {
        const isActive = activeTierId === tier.id;
        const isHighest = idx === tiers.length - 1;
        const accent = tier.color || (isHighest ? '#f59e0b' : '#a78bfa');

        return (
          <div
            key={tier.id}
            className={`relative rounded-2xl border p-5 flex flex-col gap-3 transition-all ${
              isActive
                ? 'border-emerald-500 bg-emerald-500/5'
                : 'border-border bg-card hover:border-purple-500/40'
            }`}
          >
            {isHighest && (
              <Badge className="absolute -top-2.5 left-4 bg-amber-500/90 text-white border-0 text-xs gap-1">
                <Crown className="w-3 h-3" /> Top Tier
              </Badge>
            )}
            {isActive && (
              <Badge className="absolute -top-2.5 right-4 bg-emerald-500/90 text-white border-0 text-xs">
                Current
              </Badge>
            )}

            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-black" style={{ color: accent }}>{tier.name}</h3>
              <p className="text-2xl font-black text-foreground">${tier.price_usd}</p>
            </div>

            {tier.description && (
              <p className="text-xs text-muted-foreground">{tier.description}</p>
            )}

            <div className="flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span className="font-bold text-yellow-400">{tier.xp_multiplier || 1}× XP</span>
              <span className="text-muted-foreground">multiplier</span>
            </div>

            <ul className="space-y-1.5 flex-1">
              {(tier.perks || []).map((perk, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => onJoin?.(tier.id)}
              disabled={disabled || busyTierId === tier.id || isActive}
              className="w-full rounded-xl font-bold mt-2"
              style={{ backgroundColor: isActive ? undefined : accent }}
            >
              {busyTierId === tier.id ? 'Joining…' : isActive ? 'Active' : `Join ${tier.name}`}
            </Button>
          </div>
        );
      })}
    </div>
  );
}