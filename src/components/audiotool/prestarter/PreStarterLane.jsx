import { Loader2, RefreshCw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

/** One compact lane: label, arrangement bar, mute/solo/volume, regenerate. */
export default function PreStarterLane({ lane, mix, total, busy, onUpdate, onRegen }) {
  const { buffer } = lane;
  const btn = (on) => `h-7 w-7 rounded-md text-[11px] font-bold border transition-colors ${on ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground hover:text-foreground'}`;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-3 py-2">
      <span className="w-14 text-xs font-semibold uppercase tracking-wide">{lane.label}</span>
      <div className="relative flex-1 h-6 rounded-md bg-muted overflow-hidden">
        {busy && <Loader2 className="absolute inset-0 m-auto w-4 h-4 animate-spin text-muted-foreground" />}
        {buffer && !busy && lane.span && (
          <div className="absolute inset-y-1 rounded bg-accent/60"
            style={{ left: `${(lane.span[0] / total) * 100}%`, width: `${((lane.span[1] - lane.span[0]) / total) * 100}%` }} />
        )}
      </div>
      <button className={btn(mix.muted)} onClick={() => onUpdate({ muted: !mix.muted })} title="Mute">M</button>
      <button className={btn(mix.solo)} onClick={() => onUpdate({ solo: !mix.solo })} title="Solo">S</button>
      <Slider className="w-20" min={0} max={1.5} step={0.05} value={[mix.volume]} onValueChange={([v]) => onUpdate({ volume: v })} />
      <button onClick={onRegen} disabled={busy} title={`Regenerate ${lane.label.toLowerCase()}`}
        className="text-muted-foreground hover:text-foreground disabled:opacity-40">
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  );
}