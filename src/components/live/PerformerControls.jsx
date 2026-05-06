import { Play, Pause, SkipBack, Mic, MicOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Performer playback controls — publishes play/pause/seek events via onEvent.
 */
export default function PerformerControls({
  track,
  isPlaying,
  currentTime,
  duration,
  micActive,
  onPlay,
  onPause,
  onRestart,
  onSeek,
  onMicToggle,
  isLive,
  showMic = true,
}) {
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeekClick = (e) => {
    if (!duration) return;
    const pct = e.nativeEvent.offsetX / e.currentTarget.offsetWidth;
    onSeek?.(pct * duration);
  };

  return (
    <div className="space-y-3">
      {/* Seek bar */}
      <div className="space-y-1">
        <div
          className="h-2 rounded-full bg-border cursor-pointer overflow-hidden"
          onClick={handleSeekClick}
        >
          <div
            className="h-full bg-red-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRestart}
          disabled={!track || !isLive}
          className="p-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all disabled:opacity-40"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={!track || !isLive}
          className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
        >
          {isPlaying ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Play</>}
        </button>

        {showMic && (
          <button
            onClick={onMicToggle}
            disabled={!isLive}
            className={`p-2 rounded-lg transition-all disabled:opacity-40 ${
              micActive
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title={micActive ? 'Mute mic' : 'Enable mic'}
          >
            {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
        )}
      </div>

      {showMic && micActive && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-xs text-red-400 font-semibold">Mic active</p>
        </div>
      )}
    </div>
  );
}