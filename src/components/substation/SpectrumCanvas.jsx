import { useEffect, useRef } from 'react';

// Real-time spectrum + peak trail drawn straight from the engine's analyser.
export default function SpectrumCanvas({ engine, height = 96 }) {
  const ref = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let raf;

    const draw = () => {
      const w = cv.width = cv.clientWidth * (window.devicePixelRatio || 1);
      const h = cv.height = height * (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (h / 4) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      const { spectrum } = engine.levels();
      if (spectrum) {
        const bins = 72;
        const step = Math.floor(spectrum.length / bins);
        const bw = w / bins;
        for (let i = 0; i < bins; i++) {
          let v = 0;
          for (let j = 0; j < step; j++) v = Math.max(v, spectrum[i * step + j]);
          const mag = (v / 255) ** 1.15;
          const bh = mag * h;
          const g = ctx.createLinearGradient(0, h, 0, h - bh);
          g.addColorStop(0, '#14b8a6');
          g.addColorStop(0.6, '#f59e0b');
          g.addColorStop(1, '#FF9A4D');
          ctx.fillStyle = g;
          ctx.fillRect(i * bw + bw * 0.15, h - bh, bw * 0.7, bh);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine, height]);

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden bg-[#09090b]">
      <canvas ref={ref} style={{ width: '100%', height }} />
    </div>
  );
}