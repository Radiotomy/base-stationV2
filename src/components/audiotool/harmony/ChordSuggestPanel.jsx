import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { suggestNext, GENRES, DECADES } from '@/lib/chordseq/chordSeqModel';

import StyleWeightPicker from './StyleWeightPicker';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';

export default function ChordSuggestPanel({ chords, onPick }) {
  const [genre, setGenre] = useState({ Pop: 1 });
  const [decade, setDecade] = useState({ 2020: 1 });
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
      <p className="text-sm font-semibold flex items-center gap-1.5">Chord Compass <InfoTip text={TIPS.chordCompass} /></p>
      <StyleWeightPicker label="Genre blend" options={GENRES} weights={genre} onChange={setGenre} />
      <StyleWeightPicker label="Decade blend" options={DECADES} weights={decade} onChange={setDecade} format={(d) => `${d}s`} />
      <div className="flex flex-wrap items-center gap-2">
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
      <p className="text-[10px] text-muted-foreground">Chord Compass runs on your device, powered by ChordSeqAI (MIT, © 2023 Student Trainee Center). Accepted suggestions are logged as AI-assisted; chords you choose yourself stay human.</p>
    </div>
  );
}