import { Slider } from '@/components/ui/slider';
import { Download } from 'lucide-react';

const EMOJI = {
  vocals: '🎤', drums: '🥁', bass: '🎵', guitar: '🎸', piano: '🎹', other: '🎺',
};

/** One deck lane: name, fader, pan, mute/solo, download. */
export default function StemLane({ stem, state, onChange }) {
  const label = stem.metadata?.stem_type || stem.stem_type || 'stem';
  const s = state || { volume: 80, pan: 0, muted: false, solo: false };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30 border border-border">
      <div className="w-24 shrink-0 flex items-center gap-2">
        <span className="text-base">{EMOJI[label] || '🎚️'}</span>
        <p className="text-xs font-bold capitalize truncate">{label}</p>
      </div>

      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onChange({ muted: !s.muted })}
          className={`h-6 w-7 rounded-md text-[10px] font-black border transition-colors ${
            s.muted ? 'bg-destructive/20 text-destructive border-destructive/40' : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >M</button>
        <button
          onClick={() => onChange({ solo: !s.solo })}
          className={`h-6 w-7 rounded-md text-[10px] font-black border transition-colors ${
            s.solo ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >S</button>
      </div>

      <div className="flex-1 min-w-[80px] flex items-center gap-2">
        <Slider value={[s.volume]} max={100} step={1}
          onValueChange={([v]) => onChange({ volume: v })} className="flex-1" />
        <span className="w-8 text-[10px] font-mono text-muted-foreground text-right">{s.volume}</span>
      </div>

      <div className="w-24 shrink-0 flex items-center gap-2">
        <Slider value={[s.pan]} min={-100} max={100} step={1}
          onValueChange={([p]) => onChange({ pan: p })} className="flex-1" />
        <span className="w-5 text-[10px] font-mono text-muted-foreground">
          {s.pan > 0 ? 'R' : s.pan < 0 ? 'L' : 'C'}
        </span>
      </div>

      <a href={stem.file_url} download target="_blank" rel="noopener noreferrer"
        title="Download stem"
        className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground">
        <Download className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}