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

// Industry-standard VU coloration presets. Each scheme returns the segment
// color based on the segment's position (0..1) plus whether it's the moving
// peak indicator. Zone thresholds reflect broadcast/mastering norms:
//   green (safe) → yellow (caution) → red (over).
const COLOR_SCHEMES = {
  classic: {
    label: 'Classic',
    desc: 'Standard green / yellow / red',
    seg: (p) => p < 0.7 ? 'bg-emerald-500' : p < 0.87 ? 'bg-yellow-400' : 'bg-red-500',
    peak: 'bg-red-400',
  },
  broadcast: {
    label: 'Broadcast',
    desc: 'EBU R128 / BBC bands',
    seg: (p) => p < 0.6 ? 'bg-lime-500' : p < 0.83 ? 'bg-amber-400' : 'bg-rose-600',
    peak: 'bg-orange-300',
  },
  vintage: {
    label: 'Vintage',
    desc: 'Warm amber / cream / red',
    seg: (p) => p < 0.7 ? 'bg-amber-500' : p < 0.87 ? 'bg-orange-400' : 'bg-red-600',
    peak: 'bg-yellow-200',
  },
  mastering: {
    label: 'Mastering',
    desc: 'Cool blue → red (loud-zone aware)',
    seg: (p) => p < 0.6 ? 'bg-sky-400' : p < 0.8 ? 'bg-cyan-300' : p < 0.92 ? 'bg-amber-400' : 'bg-red-500',
    peak: 'bg-white',
  },
  studio: {
    label: 'Studio',
    desc: 'Neutral white / amber / red',
    seg: (p) => p < 0.7 ? 'bg-zinc-200' : p < 0.87 ? 'bg-amber-400' : 'bg-red-500',
    peak: 'bg-white',
  },
};

// Glow effect presets — softer halo around lit segments.
const GLOW_EFFECTS = {
  soft:    { label: 'Soft',    blur: 4,  spread: 0 },
  bloom:   { label: 'Bloom',   blur: 8,  spread: 1 },
  neon:    { label: 'Neon',    blur: 12, spread: 2 },
  none:    { label: 'None',    blur: 0,  spread: 0 },
};

const STORAGE_KEY = 'vumeter_color_scheme';
const GLOW_STORAGE_KEY = 'vumeter_glow_effect';

export default function StereoVUMeter({ leftAnalyser, rightAnalyser, active = false }) {
  const [levels, setLevels] = useState({ l: 0, r: 0, lPeak: 0, rPeak: 0, lDb: -Infinity, rDb: -Infinity });
  const [scheme, setScheme] = useState(() => {
    if (typeof window === 'undefined') return 'classic';
    return localStorage.getItem(STORAGE_KEY) || 'classic';
  });
  const [glow, setGlow] = useState(() => {
    if (typeof window === 'undefined') return 'soft';
    return localStorage.getItem(GLOW_STORAGE_KEY) || 'soft';
  });
  const [showPicker, setShowPicker] = useState(false);
  const rafRef = useRef(null);
  const peakHoldRef = useRef({ l: 0, r: 0, lTime: 0, rTime: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, scheme);
  }, [scheme]);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(GLOW_STORAGE_KEY, glow);
  }, [glow]);

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

  const activeScheme = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.classic;
  const activeGlow = GLOW_EFFECTS[glow] || GLOW_EFFECTS.soft;

  return (
    <div className="bg-black rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-bold relative">
        <span>VU Meter</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(s => !s)}
            className="text-[10px] normal-case tracking-normal text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border/40 hover:border-border"
            title="VU meter color & glow"
          >
            {activeScheme.label} · {activeGlow.label}
          </button>
          <span>{active ? '● LIVE' : '○ IDLE'}</span>
        </div>

        {showPicker && (
          <div className="absolute right-0 top-full mt-1 z-20 bg-zinc-900 border border-border rounded-lg p-2 shadow-xl min-w-[220px] space-y-2">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 px-1">Color Scheme</p>
              {Object.entries(COLOR_SCHEMES).map(([key, s]) => (
                <label key={key} className="flex items-center gap-2 px-1.5 py-1 hover:bg-zinc-800 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheme === key}
                    onChange={() => setScheme(key)}
                    className="w-3 h-3 accent-amber-500"
                  />
                  <div className="flex-1 normal-case tracking-normal">
                    <p className="text-[11px] font-semibold text-foreground">{s.label}</p>
                    <p className="text-[9px] text-muted-foreground">{s.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="border-t border-border/50 pt-2">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 px-1">Glow Effect</p>
              {Object.entries(GLOW_EFFECTS).map(([key, g]) => (
                <label key={key} className="flex items-center gap-2 px-1.5 py-1 hover:bg-zinc-800 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={glow === key}
                    onChange={() => setGlow(key)}
                    className="w-3 h-3 accent-amber-500"
                  />
                  <span className="text-[11px] font-semibold text-foreground normal-case tracking-normal">{g.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <MeterRow label="L" level={levels.l} peak={levels.lPeak} db={levels.lDb} scheme={activeScheme} glow={activeGlow} />
        <MeterRow label="R" level={levels.r} peak={levels.rPeak} db={levels.rDb} scheme={activeScheme} glow={activeGlow} />
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

function MeterRow({ label, level, peak, db, scheme, glow }) {
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
          const p = i / segments;
          let bg = 'bg-zinc-800';
          if (isLit) bg = scheme.seg(p);
          else if (isPeak) bg = scheme.peak;
          return (
            <div
              key={i}
              className={`flex-1 rounded-sm ${bg} transition-colors ${isPeak && !isLit ? 'opacity-90' : ''}`}
              style={{ boxShadow: (isLit && glow.blur > 0) ? `0 0 ${glow.blur}px ${glow.spread}px currentColor` : 'none' }}
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