import { Waves, AudioWaveform } from 'lucide-react';

export default function TimelineClip({ clip, color, pxPerBeat, selected, onSelect, onDragStart, onResizeStart, sliceMode }) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
        if (!sliceMode) onDragStart(e);
      }}
      className={`absolute top-1 bottom-1 rounded-md overflow-hidden border ${
        selected ? 'border-white ring-1 ring-white/40' : 'border-black/40'
      } ${sliceMode ? 'cursor-crosshair' : 'cursor-grab'}`}
      style={{
        left: clip.start * pxPerBeat,
        width: Math.max(14, clip.length * pxPerBeat),
        background: `linear-gradient(160deg, ${color}dd 0%, ${color}77 100%)`,
      }}
    >
      <div className="flex items-center gap-1 px-1.5 pt-1">
        {clip.url ? <AudioWaveform className="w-2.5 h-2.5 text-black/70 shrink-0" /> : <Waves className="w-2.5 h-2.5 text-black/70 shrink-0" />}
        <span className="text-[9px] font-mono font-bold text-black/80 truncate">{clip.name}</span>
      </div>
      <div
        onPointerDown={(e) => { e.stopPropagation(); onSelect(); onResizeStart(e); }}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-black/25 hover:bg-black/45"
      />
    </div>
  );
}