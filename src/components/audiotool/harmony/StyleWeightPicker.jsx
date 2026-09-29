import { Minus, Plus } from 'lucide-react';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';

// Weighted multi-select: each chip's weight is its share of the blend (0 = off).
export default function StyleWeightPicker({ label, options, weights, onChange, format = (o) => o }) {
  const set = (o, d) => {
    const next = { ...weights, [o]: Math.max(0, Math.min(5, (weights[o] || 0) + d)) };
    if (!next[o]) delete next[o];
    onChange(next);
  };
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">{label} {!Object.keys(weights).length && '· any'} <InfoTip text={TIPS.styleBlend} /></p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const w = weights[o] || 0;
          return w ? (
            <span key={o} className="inline-flex items-center gap-1 rounded-full border border-accent px-2 py-0.5 text-xs">
              <button type="button" aria-label={`Less ${o}`} onClick={() => set(o, -1)}><Minus className="w-3 h-3" /></button>
              {format(o)} ×{w}
              <button type="button" aria-label={`More ${o}`} onClick={() => set(o, 1)}><Plus className="w-3 h-3" /></button>
            </span>
          ) : (
            <button key={o} type="button" onClick={() => set(o, 1)}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">{format(o)}</button>
          );
        })}
      </div>
    </div>
  );
}