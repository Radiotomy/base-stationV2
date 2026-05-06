import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Canvas-based audio-reactive visualizer preview.
 * Uses Web Audio API AnalyserNode to drive 6 visual styles in real time.
 */
export default function VisualizerPreview({ src, style = 'spectrum', title }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);

  const setupAudio = () => {
    if (ctxRef.current) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (e) {
      setError('Audio source blocked by CORS — preview limited');
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const c = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(data);

    // bg gradient based on style
    const bgGrad = c.createLinearGradient(0, 0, 0, h);
    const palette = {
      spectrum:  ['#1a0033', '#000'],
      particles: ['#001a33', '#000'],
      waveform:  ['#0a0a0a', '#000'],
      liquid:    ['#001f1a', '#000'],
      cinematic: ['#1f0a0a', '#000'],
      retro:     ['#1a001a', '#000'],
    }[style] || ['#000', '#000'];
    bgGrad.addColorStop(0, palette[0]);
    bgGrad.addColorStop(1, palette[1]);
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, w, h);

    if (style === 'spectrum') {
      const barWidth = w / bufferLength * 2;
      for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / 255;
        const barHeight = v * h;
        const hue = (i / bufferLength) * 280 + 240;
        c.fillStyle = `hsl(${hue}, 80%, ${50 + v * 20}%)`;
        c.fillRect(i * barWidth, h - barHeight, barWidth - 1, barHeight);
      }
    } else if (style === 'waveform') {
      analyser.getByteTimeDomainData(data);
      c.lineWidth = 3;
      c.strokeStyle = '#a78bfa';
      c.beginPath();
      const slice = w / bufferLength;
      for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) c.moveTo(i * slice, y);
        else c.lineTo(i * slice, y);
      }
      c.stroke();
    } else if (style === 'particles') {
      const avg = data.reduce((a, b) => a + b, 0) / bufferLength;
      const count = 80;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Date.now() / 2000;
        const radius = 60 + (avg / 255) * 120 + Math.sin(Date.now() / 500 + i) * 20;
        const x = w / 2 + Math.cos(angle) * radius;
        const y = h / 2 + Math.sin(angle) * radius;
        c.fillStyle = `hsla(${(i / count) * 360}, 90%, 60%, 0.8)`;
        c.beginPath();
        c.arc(x, y, 2 + (avg / 255) * 4, 0, Math.PI * 2);
        c.fill();
      }
    } else if (style === 'liquid') {
      const avg = data.reduce((a, b) => a + b, 0) / bufferLength;
      c.fillStyle = `rgba(20, 184, 166, ${0.3 + (avg / 255) * 0.5})`;
      c.beginPath();
      c.moveTo(0, h / 2);
      for (let x = 0; x <= w; x += 5) {
        const idx = Math.floor((x / w) * bufferLength);
        const v = data[idx] / 255;
        const y = h / 2 + Math.sin(x / 30 + Date.now() / 300) * 30 * v + v * 80;
        c.lineTo(x, y);
      }
      c.lineTo(w, h);
      c.lineTo(0, h);
      c.closePath();
      c.fill();
    } else if (style === 'cinematic') {
      const avg = data.reduce((a, b) => a + b, 0) / bufferLength;
      const grad = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      grad.addColorStop(0, `rgba(239, 68, 68, ${0.4 + (avg / 255) * 0.6})`);
      grad.addColorStop(1, 'transparent');
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#000';
      c.fillRect(0, 0, w, h * 0.1);
      c.fillRect(0, h * 0.9, w, h * 0.1);
    } else if (style === 'retro') {
      const lines = 20;
      for (let i = 0; i < lines; i++) {
        const idx = Math.floor((i / lines) * bufferLength);
        const v = data[idx] / 255;
        c.strokeStyle = `hsl(${300 + i * 5}, 100%, ${40 + v * 40}%)`;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, (i / lines) * h);
        c.lineTo(w, (i / lines) * h + Math.sin(Date.now() / 200 + i) * v * 30);
        c.stroke();
      }
      // scanline
      c.fillStyle = 'rgba(255,255,255,0.03)';
      for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    }

    rafRef.current = requestAnimationFrame(draw);
  };

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
    } else {
      setupAudio();
      if (ctxRef.current?.state === 'suspended') await ctxRef.current.resume();
      try {
        await a.play();
        setPlaying(true);
        draw();
      } catch (e) {
        setError('Playback blocked');
      }
    }
  };

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    try { ctxRef.current?.close(); } catch {}
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden bg-black border border-border" style={{ aspectRatio: '16/9' }}>
        <canvas ref={canvasRef} width={960} height={540} className="w-full h-full" />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Button onClick={togglePlay} size="lg" className="rounded-full bg-white/10 backdrop-blur hover:bg-white/20 gap-2">
              <Play className="w-5 h-5" /> Play Visualizer
            </Button>
          </div>
        )}
        {playing && (
          <button onClick={togglePlay}
            className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center backdrop-blur">
            <Pause className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
      <audio ref={audioRef} src={src} crossOrigin="anonymous" onEnded={() => setPlaying(false)} />
      {error && <p className="text-xs text-amber-400">⚠ {error}</p>}
      <p className="text-xs text-muted-foreground">{title} · <span className="capitalize">{style}</span> style</p>
    </div>
  );
}