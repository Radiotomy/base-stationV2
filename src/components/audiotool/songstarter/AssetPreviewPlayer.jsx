import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { loadAsWavFile } from '@/lib/audiotool/localAudio';
import SendToAudiotoolButton from './SendToAudiotoolButton';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Local WAV audition (play / pause / volume) with a one-click push into Audiotool. */
export default function AssetPreviewPlayer({ url, title, subtitle, bpm, aiTool, prompt }) {
  const audioRef = useRef(null);
  const [file, setFile] = useState(null);
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [time, setTime] = useState({ now: 0, total: 0 });

  useEffect(() => {
    let objectUrl;
    let dead = false;
    setFile(null); setSrc(''); setError(''); setPlaying(false);
    loadAsWavFile(url, title)
      .then((f) => {
        if (dead) return;
        objectUrl = URL.createObjectURL(f);
        setFile(f);
        setSrc(objectUrl);
      })
      .catch((e) => !dead && setError(e.message));
    return () => { dead = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, title]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume, src]);

  const toggle = () => (playing ? audioRef.current.pause() : audioRef.current.play());

  return (
    <div className="merc-card rounded-xl p-4 space-y-3">
      <div className="min-w-0">
        <p className="font-semibold truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!src && !error && (
        <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Preparing local WAV preview…</p>
      )}
      {src && (
        <>
          <audio ref={audioRef} src={src} className="hidden"
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
            onLoadedMetadata={(e) => setTime({ now: 0, total: e.target.duration })}
            onTimeUpdate={(e) => setTime((t) => ({ ...t, now: e.target.currentTime }))} />
          <div className="flex items-center gap-3">
            <Button size="icon" variant="outline" onClick={toggle}>
              {playing ? <Pause /> : <Play />}
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground w-20">{fmt(time.now)} / {fmt(time.total)}</span>
            <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <Slider value={[volume]} max={1} step={0.01} onValueChange={([v]) => setVolume(v)} className="flex-1 max-w-40" />
          </div>
          <div className="flex flex-wrap gap-2">
            <SendToAudiotoolButton getFile={() => file} name={title} bpm={bpm} aiTool={aiTool} prompt={prompt} />
            <Button asChild size="sm" variant="outline">
              <a href={src} download={file?.name}><Download className="w-3.5 h-3.5" /> WAV</a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}