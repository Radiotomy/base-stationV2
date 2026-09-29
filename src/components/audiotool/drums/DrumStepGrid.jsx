import { DRUM_VOICES } from '@/lib/audiotool/drumPattern';
import MercuryPad from '@/components/audiotool/mercury/MercuryPad';

export default function DrumStepGrid({ pattern, onToggle }) {
  const cols = { gridTemplateColumns: `5.5rem repeat(${pattern.steps}, minmax(0, 1fr))` };
  return (
    <div className="overflow-x-auto rack-screen p-3">
      <div className="min-w-[640px] space-y-1">
        <div className="grid gap-1 items-center" style={cols}>
          <span className="rack-readout text-[10px]">Accent</span>
          {pattern.accents.map((on, i) => (
            <MercuryPad key={i} on={on} onClick={() => onToggle('accents', i)} className="h-3" aria-label={`Accent step ${i + 1}`} />
          ))}
        </div>
        {DRUM_VOICES.map(([v, label]) => (
          <div key={v} className="grid gap-1 items-center" style={cols}>
            <span className="rack-readout text-[10px] truncate">{label}</span>
            {pattern.rows[v].map((on, i) => (
              <MercuryPad key={i} on={on} beat={i % 4 === 0} dim={!pattern.accents[i]} onClick={() => onToggle(v, i)}
                className="h-7" aria-label={`${label} step ${i + 1}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}