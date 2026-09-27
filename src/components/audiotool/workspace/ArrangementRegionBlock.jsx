import { useRef, useState } from 'react';
import { BAR_PX } from '@/lib/audiotool/arrangement';
import { FAMILIES, regionFamily } from '@/lib/audiotool/familyColors';

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

  const fam = FAMILIES[regionFamily(region.type)];
  return (
    <div
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
      style={{
        left: region.start * BAR_PX, width: Math.max(14, region.length * BAR_PX - 2), transform: `translateX(${dx}px)`, touchAction: 'none',
        background: `linear-gradient(90deg, ${fam.wash.replace(/[\d.]+\)$/, '.22)')}, #241c14 100%)`,
        borderLeft: `2px solid ${fam.color}`,
      }}
      className={`absolute top-1.5 bottom-1.5 rounded-lg px-2 flex items-center text-[11px] font-semibold text-[#f1ece5] select-none cursor-grab active:cursor-grabbing border border-[#30271f] transition-shadow
        ${selected ? 'ring-2 ring-accent' : ''} ${dx ? 'z-10 shadow-2xl' : ''}`}
    >
      <span className="truncate">{region.name}</span>
    </div>
  );
}