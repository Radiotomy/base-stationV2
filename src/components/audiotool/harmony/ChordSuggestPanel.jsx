import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { suggestNext, GENRES, DECADES } from '@/lib/chordseq/chordSeqModel';

const sel = 'h-8 rounded-md border border-input bg-popover px-2 text-sm text-foreground';

export default function ChordSuggestPanel({ chords, onPick }) {
  const [genre, setGenre] = useState('Pop');
  const [decade, setDecade] = useState(2020);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true); setError('');
    try { setItems(await suggestNext(chords, { genre, decade })); }
    catch (e) { setError(`Couldn't load the suggestion model — ${e.message}`); }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={genre} onChange={(e) => setGenre(e.target.value)} className={sel}>{GENRES.map((g) => <option key={g}>{g}</option>)}</select>
        <select value={decade} onChange={(e) => setDecade(Number(e.target.value))} className={sel}>{DECADES.map((d) => <option key={d} value={d}>{d}s</option>)}</select>
        <Button size="sm" variant="outline" disabled={busy} onClick={run}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Suggest next chord
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!!items.length && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((s) => (
            <button key={s.chord} type="button" onClick={() => { onPick(s.chord); setItems([]); }}
              className="rounded-full merc-button-dark px-3 py-1 text-xs font-mono">
              {s.chord} <span className="text-muted-foreground">{Math.round(s.prob * 100)}%</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">Runs on your device with ChordSeqAI (MIT). Accepted suggestions are logged as AI-assisted; chords you choose yourself stay human.</p>
    </div>
  );
}