import React, { useEffect, useRef, useState } from 'react';

// Peak meter with a falling hold. Reads from the engine on a rAF loop rather than
// React state per frame — 60 re-renders a second would fight the canvas.
export default function LevelMeter({ engine, vertical = false, className = '' }) {
  const [level, setLevel] = useState(0);
  const peak = useRef(0);

  useEffect(() => {
    let raf;
    let last = 0;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 60) return; // ~16fps is plenty for a meter
      last = t;
      const v = engine?.getLevel?.() || 0;
      peak.current = v > peak.current ? v : peak.current * 0.88;
      setLevel(peak.current);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const pct = Math.min(100, level * 100);
  const hot = pct > 88;

  if (vertical) {
    return (
      <div className={`relative w-1.5 rounded-full bg-white/8 overflow-hidden ${className}`}>
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-[height] duration-75"
          style={{
            height: `${pct}%`,
            background: hot
              ? 'linear-gradient(to top, #FF6B4A, #FF3B2F)'
              : 'linear-gradient(to top, #FF9A4D, #FFC98A)',
          }}
        />
      </div>
    );
  }

  return (
    <div className={`relative h-1.5 rounded-full bg-white/8 overflow-hidden ${className}`}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
        style={{
          width: `${pct}%`,
          background: hot
            ? 'linear-gradient(to right, #FF9A4D, #FF3B2F)'
            : 'linear-gradient(to right, #FF9A4D, #FFC98A)',
        }}
      />
    </div>
  );
}