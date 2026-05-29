import { useEffect, useRef, useState } from 'react';

/**
 * StereoVUMeter
 * Real-time stereo VU meter driven by a Web Audio AnalyserNode pair.
 * Displays L/R level bars with peak hold markers and dBFS readout.
 *
 * Props:
 *  - leftAnalyser, rightAnalyser: AnalyserNode | null
 *  - active: boolean — whether audio is currently flowing
 */
export default function StereoVUMeter({ leftAnalyser, rightAnalyser, active = false }) {
  const [levels, setLevels] = useState({ l: 0, r: 0, lPeak: 0, rPeak: 0, lDb: -Infinity, rDb: -Infinity });
  const rafRef = useRef(null);
  const peakHoldRef = useRef({ l: 0, r: 0, lTime: 0, rTime: 0 });

  useEffect(() => {
    if (!leftAnalyser || !rightAnalyser) return;
    const lBuf = new Float32Array(leftAnalyser.fftSize);
    const rBuf = new Float32Array(rightAnalyser.fftSize);

    const tick = () => {
      leftAnalyser.getFloatTimeDomainData(lBuf);
      rightAnalyser.getFloatTimeDomainData(rBuf);

      // RMS level for each channel
      let lSum = 0, rSum = 0;
      for (let i = 0; i < lBuf.length; i++) lSum += lBuf[i] * lBuf[i];
      for (let i = 0; i < rBuf.length; i++) rSum += rBuf[i] * rBuf[i];
      const lRms = Math.sqrt(lSum / lBuf.length);
      const rRms = Math.sqrt(rSum / rBuf.length);

      // Convert to 0..1 with a perceptual curve (sqrt of RMS)
      const lLevel = Math.min(1, Math.sqrt(lRms) * 1.4);
      const rLevel = Math.min(1, Math.sqrt(rRms) * 1.4);

      const lDb = lRms > 0 ? 20 * Math.log10(lRms) : -Infinity;
      const rDb = rRms > 0 ? 20 * Math.log10(rRms) : -Infinity;

      // Peak hold — instantly track new peaks, decay slowly
      const now = performance.now();
      const ph = peakHoldRef.current;
      if (lLevel >= ph.l) { ph.l = lLevel; ph.lTime = now; }
      else if (now - ph.lTime > 800) ph.l = Math.max(lLevel, ph.l - 0.01);
      if (rLevel >= ph.r) { ph.r = rLevel; ph.rTime = now; }
      else if (now - ph.rTime > 800) ph.r = Math.max(rLevel, ph.r - 0.01);

      setLevels({ l: lLevel, r: rLevel, lPeak: ph.l, rPeak: ph.r, lDb, rDb });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [leftAnalyser, rightAnalyser]);

  // Reset peaks when audio becomes inactive
  useEffect(() => {
    if (!active) {
      peakHoldRef.current = { l: 0, r: 0, lTime: 0, rTime: 0 };
      setLevels({ l: 0, r: 0, lPeak: 0, rPeak: 0, lDb: -Infinity, rDb: -Infinity });
    }
  }, [active]);

  return (
    <div className="bg-black rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
        <span>VU Meter</span>
        <span>{active ? '● LIVE' : '○ IDLE'}</span>
      </div>
      <div className="space-y-2">
        <MeterRow label="L" level={levels.l} peak={levels.lPeak} db={levels.lDb} />
        <MeterRow label="R" level={levels.r} peak={levels.rPeak} db={levels.rDb} />
      </div>
      {/* dB scale */}
      <div className="flex justify-between text-[9px] text-muted-foreground/60 font-mono px-6">
        <span>-∞</span>
        <span>-24</span>
        <span>-12</span>
        <span>-6</span>
        <span>-3</span>
        <span className="text-red-500">0</span>
      </div>
    </div>
  );
}

function MeterRow({ label, level, peak, db }) {
  // 30 segments for blocky vintage VU look
  const segments = 30;
  const litCount = Math.round(level * segments);
  const peakIdx = Math.round(peak * segments);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono font-bold text-foreground w-3">{label}</span>
      <div className="flex-1 flex gap-0.5 h-4">
        {Array.from({ length: segments }).map((_, i) => {
          const isLit = i < litCount;
          const isPeak = i === peakIdx - 1 && peakIdx > 0;
          // Color zones: green 0-70%, yellow 70-87%, red 87%+
          let bg = 'bg-zinc-800';
          if (isLit || isPeak) {
            if (i / segments < 0.7) bg = 'bg-emerald-500';
            else if (i / segments < 0.87) bg = 'bg-yellow-400';
            else bg = 'bg-red-500';
          }
          return (
            <div
              key={i}
              className={`flex-1 rounded-sm ${bg} transition-colors ${isPeak && !isLit ? 'opacity-90' : ''}`}
              style={{ boxShadow: isLit ? `0 0 4px currentColor` : 'none' }}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">
        {db === -Infinity ? '—' : db.toFixed(1)}
      </span>
    </div>
  );
}