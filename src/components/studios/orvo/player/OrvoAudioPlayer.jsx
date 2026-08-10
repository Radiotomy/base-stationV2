import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function fmt(s) {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function OrvoAudioPlayer({ src, chapters = [], onFirstPlay }) {
  const audioRef = useRef(null);
  const firedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onEnd = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play();
      setPlaying(true);
      if (!firedRef.current) {
        firedRef.current = true;
        onFirstPlay?.();
      }
    }
  };

  const seekTo = (t) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = t;
    setCurrent(t);
  };

  const changeSpeed = (s) => {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };

  const changeVolume = (v) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <div className="merc-card rounded-2xl p-5">
      <audio ref={audioRef} src={src} preload="metadata" />

      {chapters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {chapters.map((ch, i) => (
            <button
              key={i}
              onClick={() => seekTo(ch.start_seconds || 0)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-[#FF9A4D] hover:border-[#FF9A4D]/40 transition-all"
            >
              {fmt(ch.start_seconds || 0)} · {ch.title}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          className="merc-button w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="w-full accent-[#FF9A4D]"
          />
          <div className="flex justify-between text-[11px] text-white/50 font-mono">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-[160px]">
          <Volume2 className="w-4 h-4 text-white/50 flex-shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            className="w-full accent-[#FF9A4D]"
          />
        </div>
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className={`text-[11px] font-bold px-2 py-1 rounded-md border transition-all ${
                speed === s
                  ? 'text-[#14100C] bg-[#FF9A4D] border-[#FF9A4D]'
                  : 'text-white/60 bg-white/5 border-white/10 hover:border-[#FF9A4D]/40'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}