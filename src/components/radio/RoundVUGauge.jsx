import { useEffect, useRef, useState } from "react";

/**
 * Round analog VU gauge — realistic vintage meter: aged cream face with
 * vignette, printed dB scale, red overload wedge, tapered counterweighted
 * needle, metallic pivot hub, warm backlight and glass glare.
 * Reads RMS from an AnalyserNode or simulates when CORS blocks analysis.
 */
const REST = -45;

export default function RoundVUGauge({ analyserRef, label = "L", isActive = true, simulate = false }) {
  const [angle, setAngle] = useState(REST);
  const rafRef = useRef(null);
  const bufferRef = useRef(null);
  const smoothedRef = useRef(REST);

  useEffect(() => {
    let stopped = false;
    const phase = label === "R" ? 1.7 : 0;

    const tick = () => {
      if (stopped) return;
      const analyser = analyserRef?.current;
      let targetAngle = REST;
      if (simulate) {
        const t = performance.now() / 1000;
        const beat = Math.max(0, Math.sin((t + phase) * 4.2)) ** 3;
        const sway = Math.sin((t + phase) * 0.7) * 3;
        const jitter = (Math.random() - 0.5) * 2.5;
        const db = -12 + beat * 10 + sway + jitter;
        targetAngle = db <= -20 ? -45 : db >= 3 ? 45 : db <= 0 ? -45 + ((db + 20) / 20) * 70 : 25 + (db / 3) * 20;
        smoothedRef.current += (targetAngle - smoothedRef.current) * 0.22;
        setAngle(smoothedRef.current);
      } else if (analyser && isActive) {
        if (!bufferRef.current || bufferRef.current.length !== analyser.fftSize) {
          bufferRef.current = new Float32Array(analyser.fftSize);
        }
        analyser.getFloatTimeDomainData(bufferRef.current);
        const buf = bufferRef.current;
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
        const rms = Math.sqrt(sumSq / buf.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -100;
        targetAngle = db <= -20 ? -45 : db >= 3 ? 45 : db <= 0 ? -45 + ((db + 20) / 20) * 70 : 25 + (db / 3) * 20;
        smoothedRef.current += (targetAngle - smoothedRef.current) * 0.25;
        setAngle(smoothedRef.current);
      } else {
        smoothedRef.current += (REST - smoothedRef.current) * 0.08;
        setAngle(smoothedRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserRef, isActive, simulate, label]);

  const lit = isActive || simulate;

  // Geometry — needle pivot at (50, 74) on a 100x100 viewBox
  const CX = 50, CY = 74;
  const pt = (deg, r) => [CX + Math.sin((deg * Math.PI) / 180) * r, CY - Math.cos((deg * Math.PI) / 180) * r];

  // Scale ticks: major with printed labels, minor unlabeled
  const majorTicks = [
    { db: "-20", a: -45 },
    { db: "-10", a: -22.5 },
    { db: "-7",  a: -10.5 },
    { db: "-5",  a: -0.5 },
    { db: "-3",  a: 14.5 },
    { db: "0",   a: 25, emphasis: true },
    { db: "+3",  a: 45, red: true },
  ];
  const minorTicks = [-38, -31, -16, -5.5, 7, 20, 31.7, 38.3];

  const R_ARC = 42;
  const [sx, sy] = pt(-45, R_ARC);
  const [zx, zy] = pt(25, R_ARC);
  const [ex, ey] = pt(45, R_ARC);
  // Red wedge (filled region between arc radii from 0 dB to +3 dB)
  const [zx2, zy2] = pt(25, R_ARC - 3.2);
  const [ex2, ey2] = pt(45, R_ARC - 3.2);

  // Tapered needle polygon (thin at tip, wider at base) + counterweight tail
  const rad = (angle * Math.PI) / 180;
  const sin = Math.sin(rad), cos = Math.cos(rad);
  const tipX = CX + sin * 46, tipY = CY - cos * 46;
  const baseW = 1.3; // half-width at pivot
  const perpX = cos * baseW, perpY = sin * baseW;
  const tailX = CX - sin * 8, tailY = CY + cos * 8;

  const gid = `vu-${label}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-[5px] bg-[radial-gradient(circle_at_32%_28%,#4A4038_0%,#241D16_45%,#0A0704_100%)] border border-black/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-2px_4px_rgba(0,0,0,0.8),0_8px_20px_rgba(0,0,0,0.75)]">
        <svg viewBox="0 0 100 100" className="w-full h-full block" aria-label={`${label} VU meter`}>
          <defs>
            {/* Aged cream face with warm backlight when playing */}
            <radialGradient id={`${gid}-face`} cx="45%" cy="38%" r="75%">
              <stop offset="0%" stopColor={lit ? "#FBEFC4" : "#EFE3B6"} />
              <stop offset="55%" stopColor={lit ? "#F2E2AC" : "#E6D6A2"} />
              <stop offset="85%" stopColor={lit ? "#DFC98C" : "#D2BE85"} />
              <stop offset="100%" stopColor={lit ? "#C9B172" : "#BCA76F"} />
            </radialGradient>
            {/* Inner bezel shadow ring */}
            <radialGradient id={`${gid}-shadow`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,0,0,0)" />
              <stop offset="84%" stopColor="rgba(0,0,0,0)" />
              <stop offset="94%" stopColor="rgba(40,25,10,0.35)" />
              <stop offset="100%" stopColor="rgba(20,12,5,0.65)" />
            </radialGradient>
            {/* Metallic pivot hub */}
            <radialGradient id={`${gid}-hub`} cx="38%" cy="32%" r="80%">
              <stop offset="0%" stopColor="#6B6259" />
              <stop offset="45%" stopColor="#2E2822" />
              <stop offset="100%" stopColor="#0C0906" />
            </radialGradient>
            {/* Glass glare */}
            <linearGradient id={`${gid}-glass`} x1="0%" y1="0%" x2="30%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
              <stop offset="35%" stopColor="rgba(255,255,255,0.06)" />
              <stop offset="60%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <clipPath id={`${gid}-clip`}>
              <circle cx="50" cy="50" r="46" />
            </clipPath>
          </defs>

          {/* Face */}
          <circle cx="50" cy="50" r="46" fill={`url(#${gid}-face)`} stroke="rgba(45,30,15,0.7)" strokeWidth="1" />

          <g clipPath={`url(#${gid}-clip)`}>
            {/* Scale arc */}
            <path d={`M ${sx} ${sy} A ${R_ARC} ${R_ARC} 0 0 1 ${zx} ${zy}`}
              fill="none" stroke="rgba(38,24,10,0.85)" strokeWidth="0.9" />
            {/* Red overload wedge */}
            <path d={`M ${zx} ${zy} A ${R_ARC} ${R_ARC} 0 0 1 ${ex} ${ey} L ${ex2} ${ey2} A ${R_ARC - 3.2} ${R_ARC - 3.2} 0 0 0 ${zx2} ${zy2} Z`}
              fill="#A81E1E" opacity="0.92" />

            {/* Minor ticks */}
            {minorTicks.map((a) => {
              const [x1, y1] = pt(a, R_ARC);
              const [x2, y2] = pt(a, R_ARC - 2.6);
              return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke={a > 25 ? "#7A1414" : "rgba(38,24,10,0.55)"} strokeWidth="0.45" />;
            })}
            {/* Major ticks + printed dB labels */}
            {majorTicks.map((t) => {
              const [x1, y1] = pt(t.a, R_ARC + 0.4);
              const [x2, y2] = pt(t.a, R_ARC - (t.emphasis ? 5 : 4));
              const [lx, ly] = pt(t.a, R_ARC - 8.5);
              return (
                <g key={t.db}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={t.red ? "#A81E1E" : "rgba(38,24,10,0.9)"}
                    strokeWidth={t.emphasis ? 1.1 : 0.7} />
                  <text x={lx} y={ly + 1.5} textAnchor="middle" fontSize="4.6"
                    fill={t.red ? "#A81E1E" : "rgba(38,24,10,0.9)"}
                    fontWeight={t.emphasis || t.red ? "bold" : "normal"}
                    fontFamily="Helvetica, Arial, sans-serif">
                    {t.db}
                  </text>
                </g>
              );
            })}

            {/* − / + corner marks */}
            <text x="14" y="42" fontSize="8.5" fill="rgba(38,24,10,0.85)" fontWeight="bold" fontFamily="Georgia, serif">−</text>
            <text x="80" y="42" fontSize="8.5" fill="#A81E1E" fontWeight="bold" fontFamily="Georgia, serif">+</text>

            {/* VU legend */}
            <text x="50" y="60" textAnchor="middle" fontSize="9"
              fill="rgba(38,24,10,0.85)" fontWeight="bold"
              fontFamily="Georgia, serif" fontStyle="italic" letterSpacing="1">
              VU
            </text>
            <text x="50" y="66" textAnchor="middle" fontSize="2.8"
              fill="rgba(38,24,10,0.5)" fontFamily="Helvetica, Arial, sans-serif" letterSpacing="0.5">
              BASE STATION AUDIO
            </text>

            {/* Needle drop shadow */}
            <polygon
              points={`${tipX + 1},${tipY + 1.6} ${CX - perpX + 1},${CY - perpY + 1.6} ${tailX + 1},${tailY + 1.6} ${CX + perpX + 1},${CY + perpY + 1.6}`}
              fill="rgba(0,0,0,0.25)" />
            {/* Tapered needle with counterweight tail */}
            <polygon
              points={`${tipX},${tipY} ${CX - perpX},${CY - perpY} ${tailX},${tailY} ${CX + perpX},${CY + perpY}`}
              fill="#1A1208" />
            {/* Counterweight */}
            <circle cx={tailX} cy={tailY} r="2" fill="#1A1208" />

            {/* Pivot hub */}
            <circle cx={CX} cy={CY} r="5.5" fill={`url(#${gid}-hub)`} stroke="rgba(0,0,0,0.7)" strokeWidth="0.5" />
            <circle cx={CX - 1.3} cy={CY - 1.5} r="1" fill="rgba(255,255,255,0.25)" />

            {/* Inner bezel shadow */}
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-shadow)`} />
            {/* Glass glare */}
            <ellipse cx="36" cy="26" rx="30" ry="18" fill={`url(#${gid}-glass)`} transform="rotate(-18 36 26)" />
          </g>

          {/* Bezel rim highlight */}
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6" />
        </svg>
      </div>
      <span className="text-[10px] font-mono font-bold tracking-widest text-[#B8A990]">{label}</span>
    </div>
  );
}