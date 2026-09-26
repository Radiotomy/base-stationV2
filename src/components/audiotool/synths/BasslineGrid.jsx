import { BASS_NOTES } from '@/lib/audiotool/synthPattern';

const cols = { gridTemplateColumns: '3.5rem repeat(16, minmax(0, 1fr))' };
const flag = (on) => `h-3 rounded-sm ${on ? 'bg-foreground/80' : 'bg-secondary/60'}`;

// Click a cell to set that step's note (click again for a rest).
export default function BasslineGrid({ synth, onChange }) {
  const set = (i, patch) => onChange({ ...synth, steps: synth.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const row = (label, render) => (
    <div className="grid gap-0.5 items-center" style={cols}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {synth.steps.map(render)}
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] space-y-0.5">
        {[...BASS_NOTES.keys()].reverse().map((n) => row(BASS_NOTES[n], (s, i) => (
          <button key={i} type="button" aria-label={`${BASS_NOTES[n]} step ${i + 1}`}
            onClick={() => set(i, { note: s.note === n ? null : n })}
            className={`h-4 rounded-sm border ${s.note === n ? 'bg-accent border-accent' : i % 4 === 0 ? 'bg-secondary border-border' : 'bg-secondary/40 border-border/60'}`} />
        )))}
        {row('Octave', (s, i) => (
          <button key={i} type="button" disabled={s.note === null} onClick={() => set(i, { octave: s.octave === 1 ? -1 : s.octave + 1 })}
            className="h-5 rounded-sm bg-secondary/60 text-[10px] disabled:opacity-30">{s.octave > 0 ? '+1' : s.octave < 0 ? '-1' : '0'}</button>
        ))}
        {row('Slide', (s, i) => <button key={i} type="button" onClick={() => set(i, { slide: !s.slide })} className={flag(s.slide)} aria-label={`Slide step ${i + 1}`} />)}
        {row('Accent', (s, i) => <button key={i} type="button" onClick={() => set(i, { accent: !s.accent })} className={flag(s.accent)} aria-label={`Accent step ${i + 1}`} />)}
      </div>
    </div>
  );
}