import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, Music2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Performer playback control widget.
 * Manages a hidden <audio> element and exposes play/pause/seek controls.
 * Calls onPlayStateChange(isPlaying, currentTime) so the parent can persist to LiveSession.
 */
export default function LiveNowPlaying({ track, onPlayStateChange }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // Reset when track changes
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [track?.file_url]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false, audioRef.current.currentTime);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      onPlayStateChange?.(true, audioRef.current.currentTime);
    }
  };

  const restart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    const pct = e.nativeEvent.offsetX / e.currentTarget.offsetWidth;
    const newTime = pct * duration;
    if (audioRef.current) audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    onPlayStateChange?.(isPlaying, newTime);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!track) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center justify-center h-28">
        <div className="text-center text-muted-foreground">
          <Music2 className="w-7 h-7 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No track loaded — pick one from your library below</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={track.file_url}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
      />

      {/* Track info */}
      <div className="flex items-center gap-3">
        {track.thumbnail_url ? (
          <img src={track.thumbnail_url} alt={track.title}
            className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-border" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center flex-shrink-0">
            <Music2 className="w-5 h-5 text-white/60" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-foreground truncate">{track.title}</p>
          <div className="flex gap-1.5 mt-0.5 flex-wrap">
            {track.metadata?.genre && <Badge variant="outline" className="text-xs">{track.metadata.genre}</Badge>}
            {track.metadata?.bpm && <Badge variant="outline" className="text-xs">{track.metadata.bpm} BPM</Badge>}
            {track.metadata?.mood && <Badge variant="outline" className="text-xs">{track.metadata.mood}</Badge>}
          </div>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-muted-foreground'}`} />
      </div>

      {/* Seek bar */}
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-border cursor-pointer overflow-hidden" onClick={handleSeek}>
          <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button onClick={restart}
          className="p-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
          <SkipBack className="w-4 h-4" />
        </button>
        <button onClick={toggle}
          className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all">
          {isPlaying ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Play</>}
        </button>
      </div>
    </div>
  );
}