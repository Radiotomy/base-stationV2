import { useRef, useState } from 'react';

/** Milled knob. Drag up/down (or use arrow keys) to change `value` (0–1); pointer rotates with it. */
export default function MercuryKnob({ value = 0.5, onChange, label }) {
  const start = useRef(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (v) => Math.min(1, Math.max(0, v));

  const down = (e) => { if (!onChange) return; start.current = { y: e.clientY, v: value }; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (start.current) onChange(clamp(start.current.v + (start.current.y - e.clientY) / 150)); };
  const up = () => { start.current = null; setDragging(false); };
  const key = (e) => {
    if (!onChange) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(clamp(value + 0.05));
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(clamp(value - 0.05));
  };

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span data-knob role="slider" tabIndex={onChange ? 0 : -1} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
        className={`rack-knob ${onChange ? 'rack-knob-live' : ''} ${dragging ? 'is-dragging' : ''}`}
        style={{ transform: `rotate(${-135 + value * 270}deg)` }} />
      {label && <span className="rack-readout text-[9px]">{label}</span>}
    </span>
  );
}