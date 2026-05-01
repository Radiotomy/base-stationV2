import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Play, Pause, RotateCcw, Scissors, ZoomIn, ZoomOut, Zap, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

export default function AudioEditor({ audioUrl, onSave, title = 'Audio Editor' }) {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const gainNodeRef = useRef(null);
  const bassRef = useRef(null);
  const midRef = useRef(null);
  const trebleRef = useRef(null);
  const rafRef = useRef(null);
  const sourceConnected = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const formatTime = (s) => {
    if (!s || !Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  // Set up Web Audio graph once per audioUrl
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    // Clean up previous
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;

      // Resume context if suspended (required by browsers)
      if (ctx.state === 'suspended') {
        ctx.resume().catch(err => console.warn('Failed to resume AudioContext:', err));
      }

      if (!sourceConnected.current) {
        const source = ctx.createMediaElementAudioSource(audio);
      const gain = ctx.createGain();
      const bassFilter = ctx.createBiquadFilter();
      const midFilter = ctx.createBiquadFilter();
      const trebleFilter = ctx.createBiquadFilter();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 200;
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 1;
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 4000;

      source.connect(bassFilter);
      bassFilter.connect(midFilter);
      midFilter.connect(trebleFilter);
      trebleFilter.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);

        gainNodeRef.current = gain;
        bassRef.current = bassFilter;
        midRef.current = midFilter;
        trebleRef.current = trebleFilter;
        analyserRef.current = analyser;
        sourceConnected.current = true;
      }

      const onMeta = () => { setDuration(audio.duration); setTrimEnd(audio.duration); };
      const onTime = () => {
        setCurrentTime(audio.currentTime);
        // Apply fade in/out gain automation
        if (gainNodeRef.current) {
          const t = audio.currentTime;
          const dur = audio.duration;
          let g = volume / 100;
          if (fadeIn > 0 && t < fadeIn) g = (t / fadeIn) * (volume / 100);
          if (fadeOut > 0 && dur > 0 && t > dur - fadeOut) g = ((dur - t) / fadeOut) * (volume / 100);
          gainNodeRef.current.gain.value = Math.max(0, g);
        }
      };
      const onEnded = () => setIsPlaying(false);

      audio.addEventListener('loadedmetadata', onMeta);
      audio.addEventListener('timeupdate', onTime);
      audio.addEventListener('ended', onEnded);

      return () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        audio.removeEventListener('timeupdate', onTime);
        audio.removeEventListener('ended', onEnded);
        cancelAnimationFrame(rafRef.current);
      };
    } catch (err) {
      console.error('Web Audio API initialization failed:', err);
      toast.error('Audio editor unavailable on this device');
    }
  }, [audioUrl]);

  // Draw waveform (animated while playing, static when loaded)
  useEffect(() => {
    if (!analyserRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx2d = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const drawFrame = () => {
      analyser.getByteFrequencyData(data);
      ctx2d.fillStyle = 'hsl(240,10%,6%)';
      ctx2d.fillRect(0, 0, canvas.width, canvas.height);
      const bw = (canvas.width / data.length) * 2.5;
      let x = 0;
      data.forEach(v => {
        const h = (v / 255) * canvas.height;
        const pct = v / 255;
        ctx2d.fillStyle = `hsl(${270 - pct * 60},70%,${40 + pct * 30}%)`;
        ctx2d.fillRect(x, canvas.height - h, bw, h);
        x += bw + 1;
      });
    };

    // Draw static waveform if not playing
    if (!isPlaying) {
      drawFrame();
      return;
    }

    // Animate while playing
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      drawFrame();
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, duration]);

  // EQ handlers
  const applyBass = (val) => { setBass(val); if (bassRef.current) bassRef.current.gain.value = val; };
  const applyMid = (val) => { setMid(val); if (midRef.current) midRef.current.gain.value = val; };
  const applyTreble = (val) => { setTreble(val); if (trebleRef.current) trebleRef.current.gain.value = val; };
  const applyVolume = (val) => { setVolume(val); if (gainNodeRef.current) gainNodeRef.current.gain.value = val / 100; };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); }
  };

  const handleSave = () => {
    if (trimStart >= trimEnd) { toast.error('Set valid trim points first'); return; }
    onSave?.({ trimStart, trimEnd, fadeIn, fadeOut, bass, mid, treble });
    toast.success('Edit settings saved!');
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
      <h3 className="font-black text-foreground">{title}</h3>

      {/* Waveform */}
      <canvas ref={canvasRef} width={800} height={160}
        className="w-full rounded-xl bg-[hsl(240,10%,6%)] border border-border" />

      <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" />

      {/* Timeline scrubber */}
      <div className="space-y-1">
        <Slider value={[currentTime]} onValueChange={([v]) => {
          if (audioRef.current) { audioRef.current.currentTime = v; setCurrentTime(v); }
        }} max={duration || 1} step={0.1} className="w-full" />
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={togglePlay} className="bg-purple-600 hover:bg-purple-500 rounded-xl gap-2" size="sm">
          {isPlaying ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Play</>}
        </Button>
        <Button onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; setCurrentTime(0); } }} variant="outline" size="sm" className="rounded-xl gap-2">
          <RotateCcw className="w-4 h-4" /> Reset
        </Button>
        <Button onClick={() => { setTrimStart(currentTime); toast.success(`In: ${formatTime(currentTime)}`); }} variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Scissors className="w-3.5 h-3.5" /> Set In
        </Button>
        <Button onClick={() => { setTrimEnd(currentTime); toast.success(`Out: ${formatTime(currentTime)}`); }} variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Scissors className="w-3.5 h-3.5" /> Set Out
        </Button>
        {onSave && (
          <Button onClick={handleSave} variant="outline" size="sm" className="rounded-xl gap-1.5 ml-auto text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        )}
      </div>

      {/* Trim indicator */}
      {trimEnd > 0 && trimStart < trimEnd && (
        <div className="text-xs text-muted-foreground flex gap-4 px-1">
          <span>In: <span className="text-purple-400 font-mono">{formatTime(trimStart)}</span></span>
          <span>Out: <span className="text-purple-400 font-mono">{formatTime(trimEnd)}</span></span>
          <span>Length: <span className="text-purple-400 font-mono">{formatTime(trimEnd - trimStart)}</span></span>
        </div>
      )}

      {/* Controls grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Volume */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><Volume2 className="w-3 h-3" /> Volume</label>
          <Slider value={[volume]} onValueChange={([v]) => applyVolume(v)} max={100} step={1} />
          <p className="text-xs text-muted-foreground text-center">{volume}%</p>
        </div>

        {/* Speed */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><Zap className="w-3 h-3" /> Speed</label>
          <Slider value={[playbackRate]} onValueChange={([v]) => {
            setPlaybackRate(v);
            if (audioRef.current) audioRef.current.playbackRate = v;
          }} min={0.5} max={2} step={0.1} />
          <p className="text-xs text-muted-foreground text-center">{playbackRate.toFixed(1)}x</p>
        </div>

        {/* Fade In */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Fade In</label>
          <Slider value={[fadeIn]} onValueChange={([v]) => setFadeIn(v)} max={10} step={0.1} />
          <p className="text-xs text-muted-foreground text-center">{fadeIn.toFixed(1)}s</p>
        </div>

        {/* Fade Out */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Fade Out</label>
          <Slider value={[fadeOut]} onValueChange={([v]) => setFadeOut(v)} max={10} step={0.1} />
          <p className="text-xs text-muted-foreground text-center">{fadeOut.toFixed(1)}s</p>
        </div>

        {/* Bass EQ */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Bass EQ</label>
          <Slider value={[bass]} onValueChange={([v]) => applyBass(v)} min={-12} max={12} step={1} />
          <p className="text-xs text-muted-foreground text-center">{bass > 0 ? '+' : ''}{bass} dB</p>
        </div>

        {/* Mid EQ */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Mid EQ</label>
          <Slider value={[mid]} onValueChange={([v]) => applyMid(v)} min={-12} max={12} step={1} />
          <p className="text-xs text-muted-foreground text-center">{mid > 0 ? '+' : ''}{mid} dB</p>
        </div>

        {/* Treble EQ */}
        <div className="col-span-2 md:col-span-3 space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Treble EQ</label>
          <Slider value={[treble]} onValueChange={([v]) => applyTreble(v)} min={-12} max={12} step={1} />
          <p className="text-xs text-muted-foreground text-center">{treble > 0 ? '+' : ''}{treble} dB</p>
        </div>
      </div>
    </div>
  );
}