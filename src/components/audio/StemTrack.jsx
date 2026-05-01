import { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

const STEM_COLORS = {
  vocals: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  drums: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  bass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  other: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

export default function StemTrack({ name, url, index }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);

  const toggle = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  };

  const handleVolume = (val) => {
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val / 100;
  };

  const toggleMute = () => {
    setMuted(m => {
      if (audioRef.current) audioRef.current.muted = !m;
      return !m;
    });
  };

  const colorClass = STEM_COLORS[name.toLowerCase()] || STEM_COLORS.other;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
      <audio ref={audioRef} src={url} onEnded={() => setIsPlaying(false)} />

      <Badge className={`${colorClass} border text-xs flex-shrink-0 w-16 justify-center capitalize`}>{name}</Badge>

      <button onClick={toggle} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
        {isPlaying ? <Pause className="w-3.5 h-3.5 text-foreground" /> : <Play className="w-3.5 h-3.5 text-foreground" />}
      </button>

      <div className="flex-1">
        <Slider value={[volume]} onValueChange={([v]) => handleVolume(v)} max={100} step={1} />
      </div>

      <button onClick={toggleMute} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
        {muted ? <VolumeX className="w-4 h-4 text-destructive" /> : <Volume2 className="w-4 h-4" />}
      </button>

      <span className="text-xs text-muted-foreground w-8 text-right">{volume}%</span>
    </div>
  );
}