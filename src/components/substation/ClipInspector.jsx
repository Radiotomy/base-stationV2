import { Slider } from '@/components/ui/slider';
import { Copy, Trash2 } from 'lucide-react';

export default function ClipInspector({ clip, onPatch, onDuplicate, onRemove }) {
  if (!clip) {
    return (
      <p className="text-[11px] text-white/30 leading-snug">
        Select a clip on the timeline to inspect and trim it.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-2">
      <input
        value={clip.name}
        onChange={(e) => onPatch({ name: e.target.value })}
        className="w-full bg-transparent text-xs font-semibold text-white/90 outline-none"
      />
      <p className="text-[9px] font-mono text-white/30">
        {clip.kind === 'synth' ? 'SYNTH CLIP' : 'AUDIO CLIP'} · start {clip.start.toFixed(2)} · len {clip.length.toFixed(2)} beats
      </p>

      <div className="flex items-center gap-2">
        <span className="text-[8px] font-mono text-white/35 w-8">GAIN</span>
        <Slider value={[(clip.gain ?? 1) * 100]} min={0} max={150} step={1}
          onValueChange={([v]) => onPatch({ gain: v / 100 })} className="flex-1" />
        <span className="text-[9px] font-mono text-white/50 w-7 tabular-nums">{Math.round((clip.gain ?? 1) * 100)}</span>
      </div>

      {clip.kind === 'synth' && (
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-white/35 w-8">PITCH</span>
          <Slider value={[clip.pitch || 220]} min={55} max={880} step={1}
            onValueChange={([v]) => onPatch({ pitch: v })} className="flex-1" />
          <span className="text-[9px] font-mono text-white/50 w-9 tabular-nums">{Math.round(clip.pitch || 220)}Hz</span>
        </div>
      )}

      {clip.url && (
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-white/35 w-8">OFFS</span>
          <Slider value={[clip.offset || 0]} min={0} max={30} step={0.1}
            onValueChange={([v]) => onPatch({ offset: v })} className="flex-1" />
          <span className="text-[9px] font-mono text-white/50 w-9 tabular-nums">{(clip.offset || 0).toFixed(1)}s</span>
        </div>
      )}

      <div className="flex gap-1.5 pt-1">
        <button onClick={onDuplicate}
          className="flex-1 h-6 rounded border border-white/12 text-[10px] text-white/60 hover:text-white flex items-center justify-center gap-1">
          <Copy className="w-2.5 h-2.5" /> Duplicate
        </button>
        <button onClick={onRemove}
          className="h-6 px-2 rounded border border-white/12 text-[10px] text-white/50 hover:text-[#fb7185]">
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}