import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Real MilkDrop visualizer powered by Butterchurn (WebGL port of MilkDrop 2).
 * Renders community presets reacting to the actual audio stream.
 */
export default function MilkdropVisualizer({ src, presetName, title }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const ctxRef = useRef(null);
  const vizRef = useRef(null);
  const rafRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [corsBlocked, setCorsBlocked] = useState(false);
  const [proxySrc, setProxySrc] = useState(null);
  const [proxying, setProxying] = useState(false);
  const triedProxy = useRef(false);

  const loadPreset = (viz, name, blend) => {
    const presets = butterchurnPresets.getPresets();
    const key = name && presets[name] ? name : Object.keys(presets)[0];
    viz.loadPreset(presets[key], blend);
  };

  // Hot-swap preset while playing
  useEffect(() => {
    if (vizRef.current && presetName) loadPreset(vizRef.current, presetName, 2.0);
  }, [presetName]);

  // Reset fallback state when the track changes
  useEffect(() => {
    triedProxy.current = false;
    setProxySrc(null);
    setError(null);
    setCorsBlocked(false);
  }, [src]);

  // Fallback chain when the audio fails to load:
  // 1. Proxy the file through the backend (re-uploads to CORS-enabled storage —
  //    also rescues external CDNs that block CORS or use expiring links).
  // 2. If proxying fails, retry without crossorigin (plays, but no reactivity).
  // 3. Otherwise report the link as dead.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onError = async () => {
      if (!triedProxy.current) {
        triedProxy.current = true;
        setProxying(true);
        try {
          const r = await base44.functions.invoke('proxyAudioAsset', { source_url: src, filename: 'track.mp3' });
          if (r.data?.file_url && r.data.file_url !== src) {
            setProxySrc(r.data.file_url);
            setProxying(false);
            return;
          }
        } catch { /* fall through */ }
        setProxying(false);
      }
      if (a.crossOrigin) {
        a.removeAttribute('crossorigin');
        setCorsBlocked(true);
        setError(null);
        a.load();
      } else {
        setError("This track's audio link has expired or is unreachable — try regenerating or re-uploading it.");
      }
    };
    a.addEventListener('error', onError);
    return () => a.removeEventListener('error', onError);
  }, [src]);

  const setup = () => {
    if (vizRef.current) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const canvas = canvasRef.current;
    const viz = butterchurn.createVisualizer(ctx, canvas, {
      width: canvas.width,
      height: canvas.height,
    });
    if (!corsBlocked) {
      try {
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(ctx.destination);
        viz.connectAudio(source);
      } catch {
        setCorsBlocked(true);
      }
    }
    loadPreset(viz, presetName, 0);
    ctxRef.current = ctx;
    vizRef.current = viz;
  };

  const renderLoop = () => {
    vizRef.current?.render();
    rafRef.current = requestAnimationFrame(renderLoop);
  };

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
    } else {
      setup();
      if (ctxRef.current?.state === 'suspended') await ctxRef.current.resume();
      try {
        await a.play();
        setPlaying(true);
        renderLoop();
      } catch {
        setError('Playback blocked');
      }
    }
  };

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    try { ctxRef.current?.close(); } catch { /* noop */ }
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
      <audio ref={audioRef} src={proxySrc || src} crossOrigin={corsBlocked ? undefined : 'anonymous'} onEnded={() => setPlaying(false)} />
      {proxying && <p className="text-[10px] text-muted-foreground">Fetching a playable copy of this track…</p>}
      {error && <p className="text-xs text-amber-400">⚠ {error}</p>}
      {corsBlocked && !error && (
        <p className="text-[10px] text-muted-foreground">ⓘ Audio source isn't CORS-enabled — preset runs without audio reactivity.</p>
      )}
      <p className="text-xs text-muted-foreground truncate">{title} · <span className="text-purple-300">{presetName}</span></p>
    </div>
  );
}