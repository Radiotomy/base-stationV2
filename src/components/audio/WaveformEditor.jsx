import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, RotateCcw, Scissors, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

export default function WaveformEditor({ audioUrl, onExport }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState([100]);
  const [waveform, setWaveform] = useState([]);

  // Initialize Web Audio API and draw waveform
  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;

    const audio = audioRef.current;
    const drawWaveform = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0);
        const samples = Math.floor(rawData.length / 100);
        const filtered = [];
        
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < 100; j++) {
            sum += Math.abs(rawData[i * 100 + j]);
          }
          filtered.push(sum / 100);
        }
        
        setWaveform(filtered);
        setDuration(audioBuffer.duration);
      } catch (error) {
        console.error('Waveform extraction failed:', error);
      }
    };

    drawWaveform();
  }, [audioUrl]);

  // Draw waveform to canvas
  useEffect(() => {
    if (!canvasRef.current || waveform.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 1;

    ctx.beginPath();
    waveform.forEach((val, i) => {
      const x = (i / waveform.length) * width;
      const y = height / 2 - (val * height) / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw playhead
    const playheadX = (currentTime / duration) * width;
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  }, [waveform, currentTime, duration]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={togglePlay} className="bg-cyan-600 hover:bg-cyan-500 rounded-xl h-9 w-9 p-0">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" fill="white" />}
        </Button>
        <span className="text-xs text-muted-foreground font-mono">{currentTime.toFixed(2)}s / {duration.toFixed(2)}s</span>
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={80}
        className="w-full border border-border rounded-xl cursor-pointer bg-black/50"
      />

      <Slider
        value={[currentTime]}
        onValueChange={([val]) => {
          setCurrentTime(val);
          if (audioRef.current) audioRef.current.currentTime = val;
        }}
        max={duration}
        step={0.01}
        className="w-full"
      />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <Slider value={volume} onValueChange={setVolume} max={100} className="w-20" />
        </div>
        <Button size="sm" variant="outline" className="rounded-xl h-8 gap-1.5 text-xs">
          <Scissors className="w-3.5 h-3.5" /> Trim
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl h-8 gap-1.5 text-xs">
          <Zap className="w-3.5 h-3.5" /> Effects
        </Button>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}