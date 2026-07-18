import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Compact inline audio/video player with play/pause, scrub bar, time, volume slider
 * and a download link. Auto-detects audio vs video from URL extension.
 */
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;
const isVideoUrl = (url = '') => VIDEO_EXT.test(url);

function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function InlineMediaPlayer({ url, title = 'track', poster = null }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  const isVideo = isVideoUrl(url);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted]);

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      // Exclusive playback: stop every other audio/video on the page first
      document.querySelectorAll('audio, video').forEach((other) => {
        if (other !== el && !other.paused) other.pause();
      });
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const onSeek = (e) => {
    const el = ref.current;
    if (!el || !duration) return;
    el.currentTime = parseFloat(e.target.value);
    setCurrent(el.currentTime);
  };

  const onVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (v > 0 && muted) setMuted(false);
  };

  const MediaTag = isVideo ? 'video' : 'audio';

  return (
    <div className="rounded-xl bg-black/30 border border-border p-2.5 space-y-2">
      {/* Video display (hidden for audio) */}
      {isVideo && (
        <video
          ref={ref}
          src={url}
          poster={poster || undefined}
          playsInline
          preload="metadata"
          className="w-full rounded-lg bg-black max-h-72 object-contain"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
      {!isVideo && (
        <MediaTag
          ref={ref}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}

      {/* Transport row */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          onClick={togglePlay}
          className="h-8 w-8 rounded-lg bg-purple-600 hover:bg-purple-500 flex-shrink-0"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </Button>

        <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-9 text-right">
          {formatTime(current)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={onSeek}
          className="flex-1 h-1 accent-purple-500 cursor-pointer"
          aria-label="Seek"
        />

        <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-9">
          {formatTime(duration)}
        </span>

        {/* Volume */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={onVolumeChange}
            className="w-16 h-1 accent-purple-500 cursor-pointer"
            aria-label="Volume"
          />
        </div>

        {/* Download */}
        <a href={url} download title="Download">
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" type="button">
            <Download className="w-3.5 h-3.5" />
          </Button>
        </a>
      </div>
    </div>
  );
}