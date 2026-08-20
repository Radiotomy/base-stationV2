import React, { useCallback, useRef } from 'react';

// Vertical-drag rotary control. Pointer capture keeps the gesture alive when the
// cursor leaves the knob, which is what makes fine adjustment feel like hardware.
export default function RotaryKnob({ label, value, min = 0, max = 1, step = 0.01, unit, onChange, size = 46 }) {
  const ref = useRef(null);
  const drag = useRef(null);

  const span = max - min;
  const pct = span === 0 ? 0 : (value - min) / span;
  const angle = -135 + pct * 270;

  const onPointerDown = useCallback((e) => {
    ref.current?.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, start: value };
  }, [value]);

  const onPointerMove = useCallback((e) => {
    if (!drag.current) return;
    const delta = (drag.current.y - e.clientY) / 160;
    const raw = drag.current.start + delta * span;
    const snapped = Math.round(raw / step) * step;
    const next = Math.max(min, Math.min(max, Number(snapped.toFixed(5))));
    onChange?.(next);
  }, [min, max, step, span, onChange]);

  const onPointerUp = useCallback((e) => {
    ref.current?.releasePointerCapture(e.pointerId);
    drag.current = null;
  }, []);

  const display = Math.abs(value) >= 100 ? Math.round(value) : Number(value).toFixed(2).replace(/0$/, '');

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative cursor-ns-resize touch-none rounded-full"
        style={{ width: size, height: size }}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      >
        <svg width={size} height={size} viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="#1A140E" stroke="rgba(255,255,255,0.12)" />
          <path
            d="M 24 24 L 24 24"
            stroke="none"
          />
          <circle
            cx="24" cy="24" r="17"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
            strokeDasharray="80 200"
            strokeLinecap="round"
            transform="rotate(135 24 24)"
          />
          <circle
            cx="24" cy="24" r="17"
            fill="none"
            stroke="#FF9A4D"
            strokeWidth="3"
            strokeDasharray={`${Math.max(0.5, pct * 80)} 200`}
            strokeLinecap="round"
            transform="rotate(135 24 24)"
          />
          <line
            x1="24" y1="24" x2="24" y2="10"
            stroke="#FFC98A"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(${angle} 24 24)`}
          />
        </svg>
      </div>
      <div className="text-center leading-tight">
        <div className="text-[9px] uppercase tracking-wider text-white/45">{label}</div>
        <div className="text-[10px] font-mono text-[#FFC98A]">{display}{unit ? ` ${unit}` : ''}</div>
      </div>
    </div>
  );
}