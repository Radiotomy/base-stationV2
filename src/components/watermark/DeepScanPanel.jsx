import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Radar, Loader2 } from 'lucide-react';
import PublicScanResult from '@/components/watermark/PublicScanResult';

// Walks the deep scan cursor to completion. The server processes a few candidate
// re-timings per call, so progress is driven from here rather than in one request.
export default function DeepScanPanel({ fileB64 }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true); setError(''); setResult(null); setProgress(0);
    try {
      let cursor = 0;
      while (true) {
        const res = await base44.functions.invoke('deepScanBaseMark', { fileB64, cursor });
        const d = res.data;
        setProgress(Math.round((d.cursor / d.total) * 100));
        if (d.done) { setResult(d); break; }
        cursor = d.cursor;
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Radar className="w-4 h-4 text-[#FFC98A]" /> Deep scan for re-timed audio
        </p>
        <p className="text-xs text-muted-foreground">
          Changing a track's pitch or speed doesn't erase a BASE Mark — it knocks it out of alignment so the
          standard scan can't lock on. A deep scan re-times the audio to undo that and re-checks each time.
        </p>
        <p className="text-xs text-muted-foreground">
          It only recovers <strong className="text-foreground">exact</strong> ratios: sample-rate mishandling
          (a 44.1kHz master played at 48kHz), whole semitone shifts, and precise 1–3% speed changes. A
          hand-dialed speed nudge or a pitch-preserved tempo stretch stays out of reach. Needs at least 12
          seconds of audio.
        </p>
      </div>

      <Button onClick={run} disabled={busy} className="merc-button-dark w-full">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
        {busy ? `Scanning… ${progress}%` : 'Run deep scan'}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result?.insufficient_audio && (
        <p className="text-xs text-amber-400">
          Not enough audio for a deep scan — it needs at least {result.required_seconds} seconds and this clip is{' '}
          {result.supplied_seconds}s. Recovering a re-timed mark is marginal by nature, so we'd rather decline
          than report a miss we can't stand behind.
        </p>
      )}

      {result?.detected && (
        <>
          <p className="text-xs text-emerald-400">
            Match found after correcting for: <strong>{result.transform}</strong>
          </p>
          <PublicScanResult result={result} matches={result.matches} />
        </>
      )}

      {result && !result.detected && !result.insufficient_audio && (
        <p className="text-xs text-muted-foreground">
          No mark recovered at any of the {result.total} ratios checked. This isn't proof the file was never
          marked — audio re-timed by an arbitrary amount, or tempo-stretched, stays unrecoverable.
        </p>
      )}
    </div>
  );
}