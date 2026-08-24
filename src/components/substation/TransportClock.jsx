import { useEffect, useRef } from 'react';
import { barsBeats, timecode } from '@/lib/substation/session';

// Writes the clock digits straight to the DOM at 20Hz. Deliberately not React
// state: the numbers change constantly and nothing else needs to know.
export default function TransportClock({ engine, bpm }) {
  const barsRef = useRef(null);
  const tcRef = useRef(null);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    const id = setInterval(() => {
      const pos = engine.position();
      if (barsRef.current) barsRef.current.textContent = barsBeats(pos);
      if (tcRef.current) tcRef.current.textContent = timecode(pos, bpmRef.current);
    }, 50);
    return () => clearInterval(id);
  }, [engine]);

  return (
    <div className="flex items-center gap-3 px-3 py-1 rounded-lg bg-black/40 border border-white/8">
      <div>
        <p className="text-[8px] uppercase tracking-widest text-white/35 font-mono">Bars.Beats</p>
        <p ref={barsRef} className="text-sm font-mono text-[#14b8a6] tabular-nums">1.1.00</p>
      </div>
      <div className="w-px h-7 bg-white/10" />
      <div>
        <p className="text-[8px] uppercase tracking-widest text-white/35 font-mono">Timecode</p>
        <p ref={tcRef} className="text-sm font-mono text-[#FF9A4D] tabular-nums">00:00.00</p>
      </div>
    </div>
  );
}