import { useState } from 'react';
import { NOTE_NAMES } from '@/lib/audiotool/chordWriter';

// Diatonic triads of a major key: [semitones from tonic, quality, numeral].
const DEGREES = [[0, '', 'I'], [2, 'm', 'ii'], [4, 'm', 'iii'], [5, '', 'IV'], [7, '', 'V'], [9, 'm', 'vi'], [11, 'dim', 'vii°']];
const KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'];

export default function ChordPadGrid({ onPick }) {
  const [key, setKey] = useState('C');
  const tonic = NOTE_NAMES.indexOf(key);
  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground w-32">
        Key
        <select value={key} onChange={(e) => setKey(e.target.value)}
          className="h-8 rounded-md border border-input bg-popover px-2 text-sm normal-case tracking-normal text-foreground">
          {KEYS.map((k) => <option key={k} value={k}>{k} major</option>)}
        </select>
      </label>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {DEGREES.map(([step, quality, numeral]) => {
          const chord = `${NOTE_NAMES[(tonic + step) % 12]}${quality}`;
          return (
            <button key={numeral} type="button" onClick={() => onPick(chord)}
              className="aspect-square rounded-2xl merc-button-dark flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 hover:border-accent/60">
              <span className="text-lg font-black">{chord}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{numeral}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}