import { useEffect, useRef, useState } from "react";

/**
 * Round analog VU gauge — circular cream face in a dark bezel with a
 * glowing needle, for the Boombox faceplate. Reads RMS from an
 * AnalyserNode or simulates a music-like level when CORS blocks analysis.
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

  // Geometry — pivot at (50, 62) on a 100x100 viewBox
  const pt = (deg, r) => [50 + Math.sin((deg * Math.PI) / 180) * r, 62 - Math.cos((deg * Math.PI) / 180) * r];
  const [nx, ny] = pt(angle, 38);
  const [sx, sy] = pt(-45, 34);
  const [rx0, ry0] = pt(25, 34);
  const [ex, ey] = pt(45, 34);
  const ticks = [-45, -27.5, -10, 7.5, 25, 35, 45];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[5px] bg-[radial-gradient(circle_at_35%_30%,#3A322A_0%,#15100B_60%,#0A0704_100%)] border border-black/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_6px_16px_rgba(0,0,0,0.7)]">
        <svg viewBox="0 0 100 100" className="w-full h-full block" aria-label={`${label} VU gauge`}>
          <circle cx="50" cy="50" r="46" fill="#F0E4B8" stroke="rgba(60,40,20,0.5)" strokeWidth="1" />
          {/* Scale + red zone arcs */}
          <path d={`M ${sx} ${sy} A 34 34 0 0 1 ${rx0} ${ry0}`} fill="none" stroke="rgba(40,25,10,0.75)" strokeWidth="1" />
          <path d={`M ${rx0} ${ry0} A 34 34 0 0 1 ${ex} ${ey}`} fill="none" stroke="#B42222" strokeWidth="2.4" />
          {ticks.map((a) => {
            const [x1, y1] = pt(a, 34);
            const [x2, y2] = pt(a, 30);
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke={a >= 26 ? "#B42222" : "rgba(40,25,10,0.85)"} strokeWidth="1" />;
          })}
          <text x="20" y="30" fontSize="10" fill="rgba(40,25,10,0.9)" fontWeight="bold" fontFamily="Georgia, serif">−</text>
          <text x="74" y="30" fontSize="10" fill="#B42222" fontWeight="bold" fontFamily="Georgia, serif">+</text>
          <text x="50" y="50" textAnchor="middle" fontSize="10" fill="rgba(40,25,10,0.8)" fontWeight="bold" fontFamily="Georgia, serif" fontStyle="italic">VU</text>
          {/* Needle */}
          <line x1="50" y1="62" x2={nx + 0.5} y2={ny + 0.5} stroke="rgba(0,0,0,0.35)" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="50" y1="62" x2={nx} y2={ny} stroke="#B4381E" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="50" cy="62" r="5" fill="#171310" stroke="rgba(0,0,0,0.6)" strokeWidth="0.6" />
        </svg>
      </div>
      <span className="text-[10px] font-mono font-bold tracking-widest text-[#B8A990]">{label}</span>
    </div>
  );
}