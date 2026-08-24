import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const KIND_LABEL = { synth: 'SYNTH/MIDI', audio: 'AUDIO', aux: 'AUX BUS' };

export default function TrackStrip({ track, index, total, selected, onSelect, onPatch, onMove, onRemove }) {
  const tog = (key, on) => (
    <button
      onClick={(e) => { e.stopPropagation(); onPatch({ [key]: !track[key] }); }}
      className={`w-6 h-5 rounded text-[9px] font-mono font-bold border transition-colors ${
        track[key] ? on : 'border-white/12 text-white/40 hover:text-white/70'
      }`}
    >
      {key === 'mute' ? 'M' : key === 'solo' ? 'S' : 'R'}
    </button>
  );

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-2 cursor-pointer transition-colors ${
        selected ? 'border-[#14b8a6]/60 bg-[#14b8a6]/5' : 'border-white/10 bg-black/30 hover:border-white/20'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: track.color }} />
        <input
          value={track.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onPatch({ name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-xs text-white/90 font-semibold outline-none focus:text-white"
        />
        <div className="flex flex-col">
          <button disabled={index === 0} onClick={(e) => { e.stopPropagation(); onMove(-1); }}
            className="text-white/30 hover:text-white disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
          <button disabled={index === total - 1} onClick={(e) => { e.stopPropagation(); onMove(1); }}
            className="text-white/30 hover:text-white disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-white/25 hover:text-[#fb7185]">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <p className="text-[8px] font-mono uppercase tracking-widest text-white/30 mb-1.5">
        {KIND_LABEL[track.kind]} · {track.clips.length} clips
      </p>

      <div className="flex items-center gap-1.5 mb-2">
        {tog('mute', 'border-[#fb7185] text-[#fb7185] bg-[#fb7185]/15')}
        {tog('solo', 'border-[#f59e0b] text-[#f59e0b] bg-[#f59e0b]/15')}
        {tog('arm', 'border-[#14b8a6] text-[#14b8a6] bg-[#14b8a6]/15')}
        <select
          value={track.output}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onPatch({ output: e.target.value })}
          className="ml-auto bg-black/50 border border-white/12 rounded text-[9px] font-mono text-white/60 px-1 py-0.5 outline-none"
        >
          <option value="master">→ MASTER</option>
          <option value="aux">→ AUX</option>
        </select>
      </div>

      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-white/35 w-6">VOL</span>
          <Slider value={[track.volume * 100]} min={0} max={100} step={1}
            onValueChange={([v]) => onPatch({ volume: v / 100 })} className="flex-1" />
          <span className="text-[9px] font-mono text-white/50 w-7 tabular-nums">{Math.round(track.volume * 100)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-white/35 w-6">PAN</span>
          <Slider value={[track.pan * 50 + 50]} min={0} max={100} step={1}
            onValueChange={([v]) => onPatch({ pan: (v - 50) / 50 })} className="flex-1" />
          <span className="text-[9px] font-mono text-white/50 w-7 tabular-nums">
            {track.pan === 0 ? 'C' : `${track.pan > 0 ? 'R' : 'L'}${Math.abs(Math.round(track.pan * 100))}`}
          </span>
        </div>
      </div>

      {track.patch && (
        <p className="mt-2 text-[9px] font-mono text-[#14b8a6] truncate">
          ⌁ {track.patch.title}
        </p>
      )}
    </div>
  );
}