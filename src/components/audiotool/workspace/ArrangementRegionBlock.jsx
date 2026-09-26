import { useRef, useState } from 'react';
import { BAR_PX } from '@/lib/audiotool/arrangement';

/** One region on the timeline. Drag sideways to move (snaps to bars); tap to edit. */
export default function ArrangementRegionBlock({ region, selected, onSelect, onMove }) {
  const origin = useRef(null);
  const [dx, setDx] = useState(0);

  const down = (e) => { origin.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (origin.current != null) setDx(e.clientX - origin.current); };
  const cancel = () => { origin.current = null; setDx(0); };
  const up = () => {
    const bars = Math.round(dx / BAR_PX);
    cancel();
    if (bars) onMove(Math.max(0, Math.round(region.start + bars)));
    else onSelect();
  };

  const audio = region.type === 'audioRegion';
  return (
    <div
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
      style={{ left: region.start * BAR_PX, width: Math.max(14, region.length * BAR_PX - 2), transform: `translateX(${dx}px)`, touchAction: 'none' }}
      className={`absolute top-1.5 bottom-1.5 rounded-lg px-2 flex items-center text-[11px] font-semibold select-none cursor-grab active:cursor-grabbing border transition-shadow
        ${audio ? 'bg-accent/25 border-accent/50' : 'bg-white/10 border-white/20'}
        ${selected ? 'ring-2 ring-accent' : ''} ${dx ? 'z-10 shadow-2xl' : ''}`}
    >
      <span className="truncate">{region.name}</span>
    </div>
  );
}