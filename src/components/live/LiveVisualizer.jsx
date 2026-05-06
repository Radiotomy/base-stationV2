import { useEffect, useRef } from 'react';

/**
 * Phase 4 — Live shader/style-driven visualizer for LiveWatch.
 * Reacts to nowPlaying + recent reactions. Optional audio-reactive mode.
 */
const STYLE_PALETTE = {
  spectrum: ['#1a0033', '#000'],
  particles: ['#001a33', '#000'],
  waveform: ['#0a0a0a', '#000'],
  liquid: ['#001f1a', '#000'],
  cinematic: ['#1f0a0a', '#000'],
  retro: ['#1a001a', '#000'],
};

export default function LiveVisualizer({ style = 'spectrum', isPlaying = false, recentReactions = 0 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      tRef.current += isPlaying ? 0.03 : 0.005;
      const t = tRef.current;

      const palette = STYLE_PALETTE[style] || STYLE_PALETTE.spectrum;
      const grad = c.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, palette[0]);
      grad.addColorStop(1, palette[1]);
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);

      const energy = isPlaying ? 0.7 + Math.sin(t * 2) * 0.3 : 0.2;
      const pulse = 1 + (recentReactions * 0.05);

      if (style === 'spectrum') {
        const bars = 48;
        for (let i = 0; i < bars; i++) {
          const v = (Math.sin(t * 3 + i * 0.4) * 0.5 + 0.5) * energy;
          c.fillStyle = `hsl(${(i / bars) * 280 + 240}, 80%, ${50 + v * 20}%)`;
          c.fillRect((i / bars) * w, h - v * h * pulse, w / bars - 2, v * h * pulse);
        }
      } else if (style === 'particles') {
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * Math.PI * 2 + t;
          const r = 50 + Math.sin(t + i) * 40 * energy * pulse;
          c.fillStyle = `hsla(${(i / 60) * 360}, 90%, 60%, 0.8)`;
          c.beginPath();
          c.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 3 * pulse, 0, Math.PI * 2);
          c.fill();
        }
      } else if (style === 'liquid') {
        c.fillStyle = `rgba(20, 184, 166, ${0.3 + energy * 0.5})`;
        c.beginPath();
        c.moveTo(0, h / 2);
        for (let x = 0; x <= w; x += 6) {
          c.lineTo(x, h / 2 + Math.sin(x / 30 + t) * 30 * energy * pulse);
        }
        c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
      } else {
        // cinematic / retro / waveform fallback — energy-driven radial
        const rg = c.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w / 2);
        rg.addColorStop(0, `rgba(167, 139, 250, ${energy * pulse})`);
        rg.addColorStop(1, 'transparent');
        c.fillStyle = rg;
        c.fillRect(0, 0, w, h);
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [style, isPlaying, recentReactions]);

  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-border">
      <canvas ref={canvasRef} width={960} height={540} className="w-full h-full" />
    </div>
  );
}