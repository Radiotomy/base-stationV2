import { TONE_NOTES } from '@/lib/audiotool/synthPattern';

const cols = { gridTemplateColumns: '3.5rem repeat(16, minmax(0, 1fr))' };

export default function TonematrixGrid({ synth, onChange }) {
  const toggle = (i, p) => onChange({ ...synth, grid: synth.grid.map((col, j) => (j === i ? col.map((v, q) => (q === p ? !v : v)) : col)) });
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] space-y-0.5">
        {[...TONE_NOTES.keys()].reverse().map((p) => (
          <div key={p} className="grid gap-0.5 items-center" style={cols}>
            <span className="text-[11px] text-muted-foreground">{TONE_NOTES[p]}</span>
            {synth.grid.map((col, i) => (
              <button key={i} type="button" onClick={() => toggle(i, p)} aria-label={`${TONE_NOTES[p]} step ${i + 1}`}
                className={`h-4 rounded-sm border ${col[p] ? 'bg-accent border-accent' : i % 4 === 0 ? 'bg-secondary border-border' : 'bg-secondary/40 border-border/60'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}