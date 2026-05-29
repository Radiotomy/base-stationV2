import { useEffect, useRef, useState } from "react";

/**
 * Old-school analog-style VU meter (single channel).
 * Reads RMS level from an AnalyserNode and animates a needle on a chrome arc.
 *
 * Range:  -20 dB (left, "silent") → 0 dB (center) → +3 dB (right, "red zone")
 * Needle: −60° at -20 dB, 0° at 0 dB, +30° at +3 dB
 */
export default function VUMeter({ analyserRef, label = "L", isActive = true }) {
  const [angle, setAngle] = useState(-60); // resting position
  const rafRef = useRef(null);
  const bufferRef = useRef(null);
  const smoothedRef = useRef(-60);

  useEffect(() => {
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const analyser = analyserRef?.current;
      if (analyser && isActive) {
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

        // Map -20dB → -60°, 0dB → 0°, +3dB → +30°
        // Clamp & linear interpolate per segment
        let targetAngle;
        if (db <= -20) targetAngle = -60;
        else if (db >= 3) targetAngle = 30;
        else if (db <= 0) targetAngle = -60 + ((db - -20) / 20) * 60;  // -20..0 → -60..0
        else targetAngle = (db / 3) * 30; // 0..3 → 0..30

        // Mechanical needle smoothing (ballistic damping)
        const prev = smoothedRef.current;
        const next = prev + (targetAngle - prev) * 0.25;
        smoothedRef.current = next;
        setAngle(next);
      } else {
        // Drift back to rest
        const prev = smoothedRef.current;
        const next = prev + (-60 - prev) * 0.08;
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
  }, [analyserRef, isActive]);

  // Scale tick marks (-20, -10, -5, -3, 0, +3)
  const ticks = [
    { db: -20, angle: -60, label: "20" },
    { db: -10, angle: -30, label: "10" },
    { db: -5,  angle: -15, label: "5" },
    { db: -3,  angle: -9,  label: "3" },
    { db: 0,   angle: 0,   label: "0", emphasis: true },
    { db: 3,   angle: 30,  label: "+3", red: true },
  ];

  // Needle pivot is at (50, 80) on a 100x90 viewBox; needle length ~62
  const needleX2 = 50 + Math.sin((angle * Math.PI) / 180) * 62;
  const needleY2 = 80 - Math.cos((angle * Math.PI) / 180) * 62;

  return (
    <div className="merc-card rounded-2xl p-3 flex flex-col items-center">
      <p className="text-[9px] font-bold tracking-[0.25em] text-white/60 uppercase mb-1">{label}</p>

      <div className="relative w-full">
        <svg viewBox="0 0 100 92" className="w-full h-auto" aria-label={`${label} VU meter`}>
          {/* Cream meter face background */}
          <defs>
            <radialGradient id={`vu-face-${label}`} cx="50%" cy="100%" r="100%">
              <stop offset="0%" stopColor="#F2E8C8" />
              <stop offset="60%" stopColor="#E8DCB0" />
              <stop offset="100%" stopColor="#C5B585" />
            </radialGradient>
            <linearGradient id={`vu-bezel-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#C8CDD2" />
              <stop offset="100%" stopColor="#1a1a24" />
            </linearGradient>
          </defs>

          {/* Outer chrome bezel */}
          <path d="M 5 82 A 50 50 0 0 1 95 82 L 95 86 A 50 50 0 0 0 5 86 Z"
            fill={`url(#vu-bezel-${label})`} />

          {/* Inner cream face */}
          <path d="M 8 82 A 47 47 0 0 1 92 82 L 92 88 L 8 88 Z"
            fill={`url(#vu-face-${label})`} stroke="rgba(60,40,20,0.3)" strokeWidth="0.3" />

          {/* Arc scale line */}
          <path d="M 14 80 A 42 42 0 0 1 86 80"
            fill="none" stroke="rgba(40,25,10,0.6)" strokeWidth="0.5" />

          {/* Red zone arc (0 to +3) */}
          <path d="M 50 38 A 42 42 0 0 1 86 80"
            fill="none" stroke="rgba(180,30,30,0.85)" strokeWidth="1.5" />

          {/* Tick marks */}
          {ticks.map((t) => {
            const x1 = 50 + Math.sin((t.angle * Math.PI) / 180) * 42;
            const y1 = 80 - Math.cos((t.angle * Math.PI) / 180) * 42;
            const x2 = 50 + Math.sin((t.angle * Math.PI) / 180) * 36;
            const y2 = 80 - Math.cos((t.angle * Math.PI) / 180) * 36;
            const lx = 50 + Math.sin((t.angle * Math.PI) / 180) * 30;
            const ly = 80 - Math.cos((t.angle * Math.PI) / 180) * 30;
            return (
              <g key={t.db}>
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={t.red ? "#A02020" : "rgba(40,25,10,0.85)"}
                  strokeWidth={t.emphasis ? 0.8 : 0.5} />
                <text x={lx} y={ly + 1.2} textAnchor="middle" fontSize="3.5"
                  fill={t.red ? "#A02020" : "rgba(40,25,10,0.85)"}
                  fontWeight={t.emphasis ? "bold" : "normal"}
                  fontFamily="monospace">
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* "VU" label */}
          <text x="50" y="70" textAnchor="middle" fontSize="6"
            fill="rgba(40,25,10,0.7)" fontWeight="bold"
            fontFamily="Georgia, serif" fontStyle="italic">
            VU
          </text>

          {/* Needle shadow */}
          <line x1="50" y1="80" x2={needleX2 + 0.4} y2={needleY2 + 0.4}
            stroke="rgba(0,0,0,0.4)" strokeWidth="1.2" strokeLinecap="round" />
          {/* Needle */}
          <line x1="50" y1="80" x2={needleX2} y2={needleY2}
            stroke="#1a1a24" strokeWidth="0.8" strokeLinecap="round" />

          {/* Pivot screw */}
          <circle cx="50" cy="80" r="2.5" fill="url(#vu-bezel-${label})"
            stroke="rgba(0,0,0,0.5)" strokeWidth="0.3" />
          <circle cx="50" cy="80" r="0.8" fill="rgba(0,0,0,0.7)" />
        </svg>
      </div>
    </div>
  );
}