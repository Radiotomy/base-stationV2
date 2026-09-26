import { DRUM_VOICES } from '@/lib/audiotool/drumPattern';

const cell = (on, beat, accent) =>
  `h-6 rounded-sm border transition-colors ${on ? (accent ? 'bg-accent border-accent' : 'bg-accent/70 border-accent/70')
    : beat ? 'bg-secondary border-border' : 'bg-secondary/40 border-border/60'}`;

export default function DrumStepGrid({ pattern, onToggle }) {
  const cols = { gridTemplateColumns: `5.5rem repeat(${pattern.steps}, minmax(0, 1fr))` };
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] space-y-1">
        <div className="grid gap-0.5 items-center" style={cols}>
          <span className="text-[11px] text-muted-foreground">Accent</span>
          {pattern.accents.map((on, i) => (
            <button key={i} type="button" onClick={() => onToggle('accents', i)}
              className={`h-3 rounded-sm ${on ? 'bg-foreground/80' : 'bg-secondary/60'}`} aria-label={`Accent step ${i + 1}`} />
          ))}
        </div>
        {DRUM_VOICES.map(([v, label]) => (
          <div key={v} className="grid gap-0.5 items-center" style={cols}>
            <span className="text-[11px] text-muted-foreground truncate">{label}</span>
            {pattern.rows[v].map((on, i) => (
              <button key={i} type="button" onClick={() => onToggle(v, i)}
                className={cell(on, i % 4 === 0, pattern.accents[i])} aria-label={`${label} step ${i + 1}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}