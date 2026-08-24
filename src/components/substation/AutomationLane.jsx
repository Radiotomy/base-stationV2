import { useRef } from 'react';

// Volume automation drawer for the selected track. Points are stored in beats so
// a tempo change re-times automation with the arrangement instead of drifting.
export default function AutomationLane({ track, pxPerBeat, totalBeats, onChange }) {
  const ref = useRef(null);
  const height = 64;
  const points = [...(track?.automation || [])].sort((a, b) => a.beat - b.beat);

  const add = (e) => {
    if (!track) return;
    const rect = ref.current.getBoundingClientRect();
    const beat = Math.max(0, (e.clientX - rect.left) / pxPerBeat);
    const value = Math.min(1, Math.max(0, 1 - (e.clientY - rect.top) / rect.height));
    onChange([...points, { beat, value }]);
  };

  const width = totalBeats * pxPerBeat;
  const path = points.length
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.beat * pxPerBeat} ${(1 - p.value) * height}`).join(' ')
    : '';

  return (
    <div className="border-t border-white/8 bg-black/30">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[9px] font-mono uppercase tracking-widest text-white/35">
          Automation · {track ? `${track.name} volume` : 'no track selected'}
        </span>
        {points.length > 0 && (
          <button onClick={() => onChange([])} className="text-[9px] font-mono text-white/35 hover:text-[#fb7185]">
            clear
          </button>
        )}
      </div>
      <div ref={ref} onClick={add} className="relative cursor-crosshair" style={{ width, height }}>
        <svg width={width} height={height} className="absolute inset-0">
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.06)" />
          {path && <path d={path} fill="none" stroke="#f59e0b" strokeWidth="1.5" />}
          {points.map((p, i) => (
            <circle key={i} cx={p.beat * pxPerBeat} cy={(1 - p.value) * height} r="3" fill="#FF9A4D" />
          ))}
        </svg>
      </div>
    </div>
  );
}