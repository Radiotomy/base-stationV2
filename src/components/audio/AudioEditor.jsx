import { useState, useEffect, useRef } from 'react';
import { Volume2, Play, Pause, RotateCcw, Scissors, Copy, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

export default function AudioEditor({ audioUrl, onSave, title = 'Audio Editor' }) {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Initialize Web Audio API
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyserNode = ctx.createAnalyser();
    const source = ctx.createMediaElementAudioSource(audio);
    const gainNode = ctx.createGain();

    source.connect(gainNode);
    gainNode.connect(analyserNode);
    analyserNode.connect(ctx.destination);

    setAudioContext(ctx);
    setAnalyser(analyserNode);

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // Draw waveform
  useEffect(() => {
    if (!analyser || !canvasRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'hsl(240, 10%, 4%)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'hsl(270, 70%, 65%)';
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  }, [analyser, isPlaying]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (value) => {
    setVolume(value[0]);
    if (audioRef.current) {
      audioRef.current.volume = value[0] / 100;
    }
  };

  const handlePlaybackRateChange = (value) => {
    setPlaybackRate(value[0]);
    if (audioRef.current) {
      audioRef.current.playbackRate = value[0];
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || !Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleTrimStart = () => {
    setTrimStart(currentTime);
    toast.success(`Trim start: ${formatTime(currentTime)}`);
  };

  const handleTrimEnd = () => {
    setTrimEnd(currentTime);
    toast.success(`Trim end: ${formatTime(currentTime)}`);
  };

  const downloadTrimmed = () => {
    if (trimStart === 0 && trimEnd === 0) {
      toast.error('Set trim points first');
      return;
    }
    onSave?.({ trimStart, trimEnd, duration: trimEnd - trimStart });
    toast.success('Trim points saved!');
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
      <div>
        <h3 className="font-black text-foreground mb-4">{title}</h3>

        {/* Waveform Display */}
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          className="w-full rounded-xl bg-muted/30 border border-border mb-4"
        />

        {/* Audio Element */}
        <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" />

        {/* Timeline */}
        <div className="space-y-2 mb-4">
          <Slider
            value={[currentTime]}
            onValueChange={(value) => {
              if (audioRef.current) {
                audioRef.current.currentTime = value[0];
                setCurrentTime(value[0]);
              }
            }}
            max={duration}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Button
            onClick={togglePlayPause}
            className="bg-purple-600 hover:bg-purple-500 rounded-xl gap-2"
            size="sm"
          >
            {isPlaying ? (
              <><Pause className="w-4 h-4" /> Pause</>
            ) : (
              <><Play className="w-4 h-4" /> Play</>
            )}
          </Button>

          <Button onClick={() => { if (audioRef.current) audioRef.current.currentTime = 0; setCurrentTime(0); }} variant="outline" size="sm" className="rounded-xl gap-2">
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>

          <Button onClick={handleTrimStart} variant="outline" size="sm" className="rounded-xl gap-2">
            <Scissors className="w-4 h-4" /> In
          </Button>

          <Button onClick={handleTrimEnd} variant="outline" size="sm" className="rounded-xl gap-2">
            <Scissors className="w-4 h-4" /> Out
          </Button>
        </div>

        {/* Effects Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Volume</label>
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground text-center">{volume}%</div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Speed</label>
            <Slider
              value={[playbackRate]}
              onValueChange={handlePlaybackRateChange}
              min={0.5}
              max={2}
              step={0.1}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground text-center">{playbackRate.toFixed(1)}x</div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Zoom</label>
            <div className="flex gap-2">
              <Button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.5))} size="icon" variant="outline" className="rounded-xl h-8 w-8">
                <ZoomOut className="w-3 h-3" />
              </Button>
              <Button onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.5))} size="icon" variant="outline" className="rounded-xl h-8 w-8">
                <ZoomIn className="w-3 h-3" />
              </Button>
              <span className="text-xs text-muted-foreground flex items-center">{zoomLevel.toFixed(1)}x</span>
            </div>
          </div>
        </div>

        {/* Trim Info */}
        {(trimStart > 0 || trimEnd > 0) && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mt-4">
            <p className="text-xs font-semibold text-purple-300 mb-2">Trim Preview</p>
            <div className="flex justify-between text-xs text-muted-foreground mb-3">
              <span>Start: {formatTime(trimStart)}</span>
              <span>End: {formatTime(trimEnd)}</span>
              <span>Duration: {formatTime(trimEnd - trimStart)}</span>
            </div>
            <Button onClick={downloadTrimmed} className="w-full bg-purple-600 hover:bg-purple-500 rounded-xl text-xs">
              Save Trimmed
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}