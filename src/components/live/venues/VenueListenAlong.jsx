import { useEffect, useRef, useState } from 'react';
import { Headphones, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Plays the venue's audio-only idle track inside the in-world panel, in sync
 * with everyone else. Portals screens only play MP4, so this is how an MP3 on
 * the programme is actually heard. Browsers need a tap before audio can start.
 */
export default function VenueListenAlong({ url, offsetSeconds = 0, volume = 0.8 }) {
  const audioRef = useRef(null);
  const loadedAtRef = useRef(Date.now());
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    loadedAtRef.current = Date.now();
    const a = audioRef.current;
    if (a && playing) {
      a.currentTime = offsetSeconds;
      a.play().catch(() => setPlaying(false));
    }
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    a.currentTime = offsetSeconds + (Date.now() - loadedAtRef.current) / 1000;
    a.volume = volume;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <div className="merc-card rounded-2xl p-4 flex items-center gap-3">
      <audio ref={audioRef} src={url} preload="none" onEnded={() => setPlaying(false)} />
      <Button onClick={toggle} className="rounded-full h-10 px-4 gap-2 merc-button font-bold">
        {playing ? <Pause className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
        {playing ? 'Pause' : 'Listen along'}
      </Button>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Hear the room's programme, synced with everyone here.
      </p>
    </div>
  );
}