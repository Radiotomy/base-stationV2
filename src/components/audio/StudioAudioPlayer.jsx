import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, Gauge, Music2, Loader2
} from 'lucide-react';

/**
 * Premium studio-grade audio player.
 *
 * Features:
 *  - Animated waveform-style scrubber with click-to-seek
 *  - Play/pause, skip ±10s
 *  - Time display (current / total)
 *  - Volume slider with mute toggle
 *  - Playback speed (0.5x → 2x)
 *  - Loop toggle
 *  - Buffering indicator
 *  - Compact + full layouts
 *  - Keyboard: space=play/pause, ←/→=seek, ↑/↓=volume
 *
 * Props: { src, title, artist, artworkUrl, compact, autoPlay }
 */
export default function StudioAudioPlayer({
  src,
  title,
  artist,
  artworkUrl,
  compact = false,
  autoPlay = false,
}) {
  const audioRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [looping, setLooping] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const formatTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // Audio event wiring
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setIsPlaying(false);
    const onWait = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onErr = () => { setError(true); setIsPlaying(false); };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('waiting', onWait);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('canplay', onPlaying);
    audio.addEventListener('error', onErr);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('waiting', onWait);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('canplay', onPlaying);
      audio.removeEventListener('error', onErr);
    };
  }, [src]);

  // Volume + speed + loop sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = looping;
  }, [looping]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || error) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setError(true));
    }
  }, [isPlaying, error]);

  const skip = (seconds) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
  };

  const seekTo = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  };

  // Keyboard shortcuts when player is focused
  const onKeyDown = (e) => {
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-10); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); skip(10); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setVolume(v => Math.min(1, v + 0.1)); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setVolume(v => Math.max(0, v - 0.1)); }
    else if (e.key === 'm' || e.key === 'M') { setMuted(p => !p); }
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;

  // Pre-randomized "waveform" bars (decorative but reactive to progress)
  const BARS = 64;
  const barHeights = useRef(
    Array.from({ length: BARS }, () => 0.3 + Math.random() * 0.7)
  );

  if (error) {
    return (
      <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
        <Music2 className="w-4 h-4" /> Audio unavailable
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`group relative rounded-2xl bg-gradient-to-br from-card via-card to-muted/30 border border-border focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all ${compact ? 'p-3' : 'p-4'}`}
    >
      <audio ref={audioRef} src={src} preload="metadata" autoPlay={autoPlay} />

      <div className="flex items-center gap-3">
        {/* Artwork / play button */}
        <button
          onClick={togglePlay}
          className={`relative ${compact ? 'w-11 h-11' : 'w-14 h-14'} rounded-xl overflow-hidden flex-shrink-0 group/play bg-gradient-to-br from-purple-700 to-indigo-800 shadow-lg shadow-purple-900/30`}
        >
          {artworkUrl && (
            <img src={artworkUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/40 group-hover/play:bg-black/60 transition-colors flex items-center justify-center">
            {buffering ? (
              <Loader2 className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-white animate-spin`} />
            ) : isPlaying ? (
              <Pause className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-white`} fill="white" />
            ) : (
              <Play className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-white ml-0.5`} fill="white" />
            )}
          </div>
        </button>

        {/* Waveform + time */}
        <div className="flex-1 min-w-0">
          {(title || artist) && !compact && (
            <div className="flex items-baseline gap-2 mb-1.5">
              {title && <p className="text-xs font-bold text-foreground truncate">{title}</p>}
              {artist && <p className="text-xs text-muted-foreground truncate">— {artist}</p>}
            </div>
          )}

          {/* Waveform scrubber */}
          <div
            onClick={seekTo}
            className="relative h-9 cursor-pointer rounded-lg overflow-hidden flex items-center gap-[2px] px-1 group/scrub"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
          >
            {barHeights.current.map((h, i) => {
              const barPct = (i / BARS) * 100;
              const filled = barPct <= progressPct;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-colors ${filled
                    ? 'bg-gradient-to-t from-purple-500 to-pink-400'
                    : 'bg-muted-foreground/20 group-hover/scrub:bg-muted-foreground/40'}`}
                  style={{ height: `${h * 100}%` }}
                />
              );
            })}
            {/* Hover indicator */}
            <div className="absolute inset-y-0 w-px bg-white/40 opacity-0 group-hover/scrub:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${progressPct}%` }} />
          </div>

          {/* Time row */}
          <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-muted-foreground tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Control row */}
      <div className={`flex items-center gap-1 mt-2 ${compact ? 'justify-between' : 'justify-center'}`}>
        <button onClick={() => skip(-10)}
          title="Back 10s (←)"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <button onClick={togglePlay}
          title="Play / Pause (Space)"
          className="p-1.5 rounded-lg hover:bg-muted text-foreground transition-colors">
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button onClick={() => skip(10)}
          title="Forward 10s (→)"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button onClick={() => setLooping(p => !p)}
          title="Loop"
          className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${looping ? 'text-purple-400 bg-purple-500/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <Repeat className="w-3.5 h-3.5" />
        </button>

        <button onClick={cycleSpeed}
          title="Playback speed"
          className="px-2 py-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <Gauge className="w-3 h-3" />
          <span className="text-[10px] font-bold tabular-nums">{speed}×</span>
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button onClick={() => setMuted(p => !p)}
          title="Mute (M)"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        <input
          type="range"
          min="0" max="1" step="0.01"
          value={muted ? 0 : volume}
          onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
          className="w-16 h-1 accent-purple-500 cursor-pointer"
          title="Volume (↑/↓)"
        />
      </div>
    </div>
  );
}