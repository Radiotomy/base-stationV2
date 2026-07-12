import { useEffect, useRef, useState } from "react";

/**
 * Analog VU meter — rectangular cream face in a dark bezel,
 * matching the BASE Station Command Console mockup.
 * Reads RMS level from an AnalyserNode and animates a needle.
 *
 * Range:  -20 dB (left) → 0 dB → +3 dB (red zone, right)
 * Needle: −45° at -20 dB, +25° at 0 dB, +45° at +3 dB
 */
const REST = -45;

export default function VUMeter({ analyserRef, label = "L", isActive = true, simulate = false }) {
  const [angle, setAngle] = useState(REST);
  const rafRef = useRef(null);
  const bufferRef = useRef(null);
  const smoothedRef = useRef(REST);

  useEffect(() => {
    let stopped = false;
    // Per-channel phase offset so L/R needles don't move in lockstep
    const phase = label === "R" ? 1.7 : 0;

    const tick = () => {
      if (stopped) return;
      const analyser = analyserRef?.current;
      if (simulate) {
        // Stream can't be routed through the Web Audio analyser (no CORS) —
        // drive the needle with a music-like synthetic level instead.
        const t = performance.now() / 1000;
        const beat = Math.max(0, Math.sin((t + phase) * 4.2)) ** 3;        // rhythmic pulses
        const sway = Math.sin((t + phase) * 0.7) * 3;                       // slow drift
        const jitter = (Math.random() - 0.5) * 2.5;
        const db = -12 + beat * 10 + sway + jitter;                         // ~ -15..-1 dB
        let targetAngle;
        if (db <= -20) targetAngle = -45;
        else if (db >= 3) targetAngle = 45;
        else if (db <= 0) targetAngle = -45 + ((db + 20) / 20) * 70;
        else targetAngle = 25 + (db / 3) * 20;
        const prev = smoothedRef.current;
        const next = prev + (targetAngle - prev) * 0.22;
        smoothedRef.current = next;
        setAngle(next);
      } else if (analyser && isActive) {
        if (!bufferRef.current || bufferRef.current.length !== analyser.fftSize) {
          bufferRef.current = new Float32Array(analyser.fftSize);
        }
        analyser.getFloatTimeDomainData(bufferRef.current);

        // RMS calculation
        const buf = bufferRef.current;
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
        const rms = Math.sqrt(sumSq / buf.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -100;

        // Map -20dB → -45°, 0dB → +25°, +3dB → +45°
        let targetAngle;
        if (db <= -20) targetAngle = -45;
        else if (db >= 3) targetAngle = 45;
        else if (db <= 0) targetAngle = -45 + ((db + 20) / 20) * 70; // -20..0 → -45..25
        else targetAngle = 25 + (db / 3) * 20;                       // 0..3 → 25..45

        // Mechanical needle smoothing (ballistic damping)
        const prev = smoothedRef.current;
        const next = prev + (targetAngle - prev) * 0.25;
        smoothedRef.current = next;
        setAngle(next);
      } else {
        // Drift back to rest
        const prev = smoothedRef.current;
        const next = prev + (REST - prev) * 0.08;
        smoothedRef.current = next;
        setAngle(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserRef, isActive, simulate, label]);

  // Scale ticks (angle mapping above)
  const ticks = [
    { db: -20, angle: -45,   label: "20" },
    { db: -15, angle: -27.5, label: "15" },
    { db: -10, angle: -10,   label: "10" },
    { db: -5,  angle: 7.5,   label: "5" },
    { db: -3,  angle: 14.5,  label: "3" },
    { db: 0,   angle: 25,    label: "0", emphasis: true },
    { db: 1,   angle: 31.7,  label: "+1", red: true },
    { db: 2,   angle: 38.3,  label: "+2", red: true },
    { db: 3,   angle: 45,    label: "+3", red: true },
  ];

  // Needle pivot at (60, 78) on a 120x72 viewBox; needle length 58
  const needleX2 = 60 + Math.sin((angle * Math.PI) / 180) * 58;
  const needleY2 = 78 - Math.cos((angle * Math.PI) / 180) * 58;

  const arcPt = (deg, r) => [
    60 + Math.sin((deg * Math.PI) / 180) * r,
    78 - Math.cos((deg * Math.PI) / 180) * r,
  ];
  const [sx, sy] = arcPt(-45, 54);
  const [ex, ey] = arcPt(45, 54);
  const [rx0, ry0] = arcPt(25, 54);

  return (
    <div className="rounded-xl border border-black/80 bg-gradient-to-b from-[#241E17] to-[#120E0A] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_6px_16px_rgba(0,0,0,0.6)]">
      <div className="relative w-full mx-auto">
        <svg viewBox="0 0 120 72" preserveAspectRatio="xMidYMid meet" className="w-full h-auto block" aria-label={`${label} VU meter`}>
          {/* Bezel */}
          <rect x="0.5" y="0.5" width="119" height="71" rx="6" fill="#0B0805" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

          {/* Cream face */}
          <rect x="4" y="4" width="112" height="64" rx="4" fill="#F0E4B8" stroke="rgba(60,40,20,0.5)" strokeWidth="0.4" />

          <g>
            {/* Scale arc */}
            <path d={`M ${sx} ${sy} A 54 54 0 0 1 ${rx0} ${ry0}`}
              fill="none" stroke="rgba(40,25,10,0.75)" strokeWidth="0.8" />
            {/* Red zone arc (0 → +3) */}
            <path d={`M ${rx0} ${ry0} A 54 54 0 0 1 ${ex} ${ey}`}
              fill="none" stroke="#B42222" strokeWidth="2.2" />

            {/* Tick marks + labels */}
            {ticks.map((t) => {
              const [x1, y1] = arcPt(t.angle, 54);
              const [x2, y2] = arcPt(t.angle, t.emphasis ? 47 : 49);
              const [lx, ly] = arcPt(t.angle, 43);
              return (
                <g key={t.db}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={t.red ? "#B42222" : "rgba(40,25,10,0.85)"}
                    strokeWidth={t.emphasis ? 1 : 0.6} />
                  <text x={lx} y={ly} textAnchor="middle" fontSize="4.5"
                    fill={t.red ? "#B42222" : "rgba(40,25,10,0.9)"}
                    fontWeight={t.emphasis || t.red ? "bold" : "normal"}
                    fontFamily="monospace">
                    {t.label}
                  </text>
                </g>
              );
            })}

            {/* − / + corner marks */}
            <text x="12" y="14" fontSize="9" fill="rgba(40,25,10,0.9)" fontWeight="bold" fontFamily="Georgia, serif">−</text>
            <text x="101" y="14" fontSize="9" fill="#B42222" fontWeight="bold" fontFamily="Georgia, serif">+</text>

            {/* "VU" label */}
            <text x="60" y="56" textAnchor="middle" fontSize="8.5"
              fill="rgba(40,25,10,0.8)" fontWeight="bold"
              fontFamily="Georgia, serif" fontStyle="italic">
              VU
            </text>

            {/* Needle shadow */}
            <line x1="60" y1="78" x2={needleX2 + 0.5} y2={needleY2 + 0.5}
              stroke="rgba(0,0,0,0.35)" strokeWidth="1.4" strokeLinecap="round" />
            {/* Needle */}
            <line x1="60" y1="78" x2={needleX2} y2={needleY2}
              stroke="#1a1410" strokeWidth="1" strokeLinecap="round" />

            {/* Pivot hub peeking above face bottom */}
            <circle cx="60" cy="78" r="12" fill="#171310" stroke="rgba(0,0,0,0.6)" strokeWidth="0.5" />

            {/* Corner screw (bottom-left, like the mockup) */}
            <circle cx="11" cy="61" r="3" fill="#C8CDD2" stroke="rgba(0,0,0,0.5)" strokeWidth="0.4" />
            <line x1="9" y1="59" x2="13" y2="63" stroke="rgba(0,0,0,0.55)" strokeWidth="0.6" />
          </g>
        </svg>
      </div>
    </div>
  );
}