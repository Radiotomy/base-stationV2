import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ScrubWaveformPlayer
 * - Renders a full-track static peak waveform (decoded once via OfflineAudioContext-style peaks).
 * - Click anywhere on the waveform to seek; click-and-drag the playhead to scrub.
 * - Connects audio to an external AudioContext + processing node chain via `onAudioReady`.
 *
 * Props:
 *  - audioUrl: string
 *  - audioContext: AudioContext (shared)
 *  - onAudioReady: (HTMLAudioElement, MediaElementAudioSourceNode) => void
 *  - onPlayingChange: (boolean) => void
 */
export default function ScrubWaveformPlayer({ audioUrl, audioContext, onAudioReady, onPlayingChange }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const sourceRef = useRef(null);
  const dragRef = useRef(false);

  const [peaks, setPeaks] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hoverX, setHoverX] = useState(null);

  // Setup audio element + connect to shared AudioContext
  useEffect(() => {
    if (!audioUrl || !audioContext) return;
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    // Play from a locally fetched blob — same-origin, so the Web Audio chain
    // always receives real signal (no CORS "outputs zeroes" silence).
    let objectUrl = null;
    (async () => {
      try {
        const res = await fetch(audioUrl);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        audio.src = objectUrl;
      } catch {
        audio.src = audioUrl; // fallback to direct streaming
      }
    })();

    const onMeta = () => setDuration(audio.duration);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => { setIsPlaying(true); onPlayingChange?.(true); };
    const onPause = () => { setIsPlaying(false); onPlayingChange?.(false); };
    const onEnd = () => { setIsPlaying(false); onPlayingChange?.(false); };
    const onError = () => {
      // Blob playback failed — fall back to streaming the URL directly
      if (objectUrl && audio.src === objectUrl) {
        audio.src = audioUrl;
        audio.load();
      }
    };

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onError);

    try {
      const source = audioContext.createMediaElementSource(audio);
      sourceRef.current = source;
      onAudioReady?.(audio, source);
    } catch (e) {
      console.warn('Audio source already connected:', e.message);
    }

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
      audio.src = '';
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, audioContext]);

  // Decode the full track to get peaks for a static waveform render
  useEffect(() => {
    if (!audioUrl || !audioContext) return;
    let cancelled = false;
    setIsLoading(true);
    setPeaks(null);

    (async () => {
      try {
        const res = await fetch(audioUrl);
        const buf = await res.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(buf.slice(0));
        if (cancelled) return;

        const targetBins = 600;
        const channel = decoded.getChannelData(0);
        const samplesPerBin = Math.floor(channel.length / targetBins);
        const result = new Float32Array(targetBins);
        for (let i = 0; i < targetBins; i++) {
          let max = 0;
          const start = i * samplesPerBin;
          const end = Math.min(start + samplesPerBin, channel.length);
          for (let j = start; j < end; j++) {
            const v = Math.abs(channel[j]);
            if (v > max) max = v;
          }
          result[i] = max;
        }
        setPeaks(result);
      } catch (e) {
        console.warn('Peak decode failed:', e.message);
      }
      if (!cancelled) setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [audioUrl, audioContext]);

  // Draw waveform
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const progress = duration ? currentTime / duration : 0;
    const playX = progress * w;

    if (peaks) {
      const binW = w / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const x = i * binW;
        const amp = peaks[i];
        const barH = Math.max(1, amp * h * 0.9);
        const played = x < playX;
        ctx.fillStyle = played ? '#fbbf24' : '#52525b';
        ctx.fillRect(x, h / 2 - barH / 2, Math.max(1, binW - 0.5), barH);
      }
    }

    // Hover indicator
    if (hoverX !== null) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
      ctx.fillRect(0, 0, hoverX, h);
    }

    // Playhead
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, h);
    ctx.stroke();
    // Playhead grab handle
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(playX, h / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }, [peaks, currentTime, duration, hoverX]);

  useEffect(() => {
    let raf;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  const seekFromX = (clientX) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioRef.current || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const t = (x / rect.width) * duration;
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const onMouseDown = (e) => { dragRef.current = true; seekFromX(e.clientX); };
  const onMouseMove = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) setHoverX(e.clientX - rect.left);
    if (dragRef.current) seekFromX(e.clientX);
  };
  const onMouseLeave = () => { setHoverX(null); };
  const onTouchStart = (e) => { dragRef.current = true; seekFromX(e.touches[0].clientX); };
  const onTouchMove = (e) => { if (dragRef.current) seekFromX(e.touches[0].clientX); };

  useEffect(() => {
    const up = () => { dragRef.current = false; };
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (audioContext?.state === 'suspended') await audioContext.resume();
    if (isPlaying) audioRef.current.pause();
    else await audioRef.current.play();
  };

  const fmt = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Track Scrubber</p>
        <span className="text-xs font-mono text-muted-foreground">{fmt(currentTime)} / {fmt(duration)}</span>
      </div>

      <div
        className="relative rounded-xl overflow-hidden bg-black border border-border select-none"
        style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        <canvas ref={canvasRef} width={1200} height={120} className="w-full h-[120px] block" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader className="w-5 h-5 text-amber-400 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={togglePlay} disabled={!audioUrl || isLoading}
          className="rounded-lg gap-1.5 bg-amber-600 hover:bg-amber-500">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <p className="text-xs text-muted-foreground">Click or drag the waveform to scrub</p>
      </div>
    </div>
  );
}