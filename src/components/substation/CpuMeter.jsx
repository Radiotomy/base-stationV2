import { useEffect, useRef } from 'react';
import { Cpu } from 'lucide-react';

// Samples frame budget in its own loop and paints the bar directly — a CPU
// readout must never itself be a source of re-renders.
export default function CpuMeter() {
  const barRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    let raf;
    let last = performance.now();
    let acc = 0;
    let frames = 0;
    let smoothed = 0;
    let lastPaint = 0;

    const tick = (now) => {
      acc += now - last;
      last = now;
      frames++;
      if (now - lastPaint > 500) {
        const avg = acc / Math.max(1, frames);
        smoothed = smoothed * 0.6 + Math.min(100, (avg / 16.7) * 20) * 0.4;
        if (barRef.current) barRef.current.style.width = `${Math.min(100, smoothed)}%`;
        if (textRef.current) textRef.current.textContent = `${Math.round(smoothed)}%`;
        acc = 0; frames = 0; lastPaint = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/40 border border-white/8">
      <Cpu className="w-3 h-3 text-white/40" />
      <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div ref={barRef} className="h-full rounded-full"
          style={{ width: '0%', background: 'linear-gradient(90deg,#14b8a6,#f59e0b,#FF9A4D)' }} />
      </div>
      <span ref={textRef} className="text-[9px] font-mono text-white/50 w-7 tabular-nums">0%</span>
    </div>
  );
}