import { useEffect, useRef } from 'react';

// Real-time spectrum drawn from the engine's analyser.
// Sizing happens on resize only — reassigning canvas.width every frame forces a
// full layout + buffer reallocation and was a measurable drag during playback.
export default function SpectrumCanvas({ engine, height = 96 }) {
  const ref = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let raf;
    let last = 0;

    const resize = () => {
      cv.width = Math.max(1, Math.floor(cv.clientWidth * dpr));
      cv.height = Math.max(1, Math.floor(height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const grad = () => {
      const g = ctx.createLinearGradient(0, cv.height, 0, 0);
      g.addColorStop(0, '#14b8a6');
      g.addColorStop(0.6, '#f59e0b');
      g.addColorStop(1, '#FF9A4D');
      return g;
    };
    let fill = grad();

    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      // 30fps is plenty for a level display and halves the paint cost
      if (now - last < 33) return;
      last = now;

      const w = cv.width;
      const h = cv.height;
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      for (let i = 1; i < 4; i++) { const y = (h / 4) * i; ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();

      const { spectrum } = engine.levels();
      if (spectrum) {
        if (fill.__w !== w) { fill = grad(); fill.__w = w; }
        ctx.fillStyle = fill;
        const bins = 64;
        const step = Math.floor(spectrum.length / bins);
        const bw = w / bins;
        for (let i = 0; i < bins; i++) {
          let v = 0;
          for (let j = 0; j < step; j += 2) v = Math.max(v, spectrum[i * step + j]);
          const bh = ((v / 255) ** 1.15) * h;
          ctx.fillRect(i * bw + bw * 0.15, h - bh, bw * 0.7, bh);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [engine, height]);

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden bg-[#09090b]">
      <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />
    </div>
  );
}