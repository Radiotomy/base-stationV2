import { useMemo, useRef, useState } from 'react';
import { Loader2, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ChordRollRow from '@/components/cadence/ChordRollRow';
import { chartToSegments } from '@/lib/chords/chordSymbols';
import { recognizeChords, adherence } from '@/lib/chords/recognizeChords';

/** Written chart vs chords estimated from the rendered audio, on one shared playhead. */
export default function ChordSyncRolls({ asset }) {
  const m = asset?.metadata || {};
  const audioRef = useRef(null);
  const [time, setTime] = useState(0);
  const [played, setPlayed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const duration = played?.duration || m.duration || 30;
  const written = useMemo(
    () => chartToSegments(m.chord_chart, { bpm: m.bpm, timeSig: m.time_signature, duration }),
    [m.chord_chart, m.bpm, m.time_signature, duration],
  );

  const analyze = async () => {
    setBusy(true); setError('');
    try { setPlayed(await recognizeChords(asset.file_url, { bpm: m.bpm })); }
    catch (e) { setError(`Couldn't analyze this audio — ${e.message}`); }
    setBusy(false);
  };
  const seek = (t) => { if (audioRef.current) { audioRef.current.currentTime = t; audioRef.current.play(); } };

  return (
    <div className="space-y-3">
      <audio ref={audioRef} src={asset.file_url} controls className="w-full" onTimeUpdate={(e) => setTime(e.target.currentTime)} />
      <div className="relative space-y-2">
        <ChordRollRow label="Written — your chart" segments={written} duration={duration} onSeek={seek} />
        {played && <ChordRollRow label="Played — heard in the audio" segments={played.segments} duration={duration} onSeek={seek} />}
        <div className="absolute inset-y-0 w-0.5 bg-white pointer-events-none shadow" style={{ left: `${Math.min(time / duration, 1) * 100}%` }} />
      </div>
      {played ? (
        <p className="text-xs text-muted-foreground">
          <span className="rack-readout text-sm">{adherence(written, played.segments)}%</span> of the bed matched your chords (triad level, estimated).
        </p>
      ) : (
        <Button size="sm" variant="outline" onClick={analyze} disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
          {busy ? 'Listening for chords…' : 'Check what the AI actually played'}
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[10px] text-muted-foreground">Estimated on your device from the audio. It measures how closely the bed followed your chart — it doesn't change your ownership score.</p>
    </div>
  );
}