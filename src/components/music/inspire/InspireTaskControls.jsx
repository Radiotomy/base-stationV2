import { Music2, GitBranch } from 'lucide-react';
import InfoTip from '@/components/common/InfoTip';
import AssetPicker from '@/components/studio/AssetPicker';

// Inspire's two tasks and its render parameters. Split out of the tab because the
// continuation path brings a whole library picker with it, and the model choice
// changes the duration ceiling — that coupling deserves its own file.
export const INSPIRE_MODELS = [
  { id: 'InspireMusic-1.5B-Long', label: 'Long-form', maxDuration: 300, note: 'Most coherent over long pieces, up to 5 minutes' },
  { id: 'InspireMusic-1.5B', label: 'Standard', maxDuration: 90, note: 'Tighter on short pieces' },
  { id: 'InspireMusic-Base', label: 'Base', maxDuration: 90, note: 'Lighter model, quicker renders' },
  { id: 'InspireMusic-1.5B-24kHz', label: 'Fast draft', maxDuration: 90, note: 'Quickest renders, smaller file — similar sound' },
];
export const INSPIRE_SECTIONS = ['intro', 'verse', 'chorus', 'outro'];
export const INSPIRE_MIN_DURATION = 10;

export default function InspireTaskControls({ value, onChange, disabled }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const model = INSPIRE_MODELS.find(m => m.id === value.model) || INSPIRE_MODELS[0];
  const ceiling = model.maxDuration;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'text-to-music', icon: Music2, label: 'Text to Music', desc: 'Compose from a written description' },
          { id: 'continuation', icon: GitBranch, label: 'Continue a Track', desc: 'Keep composing from your own audio' },
        ].map(t => (
          <button key={t.id} type="button" disabled={disabled} onClick={() => set({ task: t.id })}
            className={`p-3 rounded-xl border-2 text-left transition-all ${value.task === t.id
              ? 'border-teal-500 bg-teal-500/10' : 'border-border bg-card hover:border-border/80'}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <t.icon className="w-4 h-4 text-teal-400" />
              <p className="text-sm font-black text-foreground">{t.label}</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">{t.desc}</p>
          </button>
        ))}
      </div>

      {value.task === 'continuation' && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            Continue From
            <InfoTip text="Inspire listens to the first few seconds of the track you pick and keeps composing in the same feel. Because your own recording seeds the result, the new track is labelled AI-assisted and linked back to its source." />
          </p>
          <AssetPicker assetType="track" selected={value.sourceId ? [value.sourceId] : []}
            onChange={(ids) => set({ sourceId: ids[0] || '' })} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Model</p>
          <select value={model.id} disabled={disabled}
            onChange={(e) => {
              const next = INSPIRE_MODELS.find(m => m.id === e.target.value) || INSPIRE_MODELS[0];
              set({ model: next.id, duration: Math.min(value.duration, next.maxDuration) });
            }}
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {INSPIRE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">{model.note}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            Section
            <InfoTip text="Which part of an arrangement this render should sound like. 'Verse' (the default) plays at steady energy; an 'intro' opens sparse and quiet; a 'chorus' lands at full energy from the first bar." />
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {INSPIRE_SECTIONS.map(s => (
              <button key={s} type="button" disabled={disabled} onClick={() => set({ section: s })}
                className={`px-3 py-2 rounded-lg text-xs font-bold capitalize border transition-all ${value.section === s
                  ? 'border-teal-500 bg-teal-500/15 text-teal-200' : 'border-border text-muted-foreground hover:border-border/80'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Length ({INSPIRE_MIN_DURATION}–{ceiling}s)
          </p>
          <input type="number" min={INSPIRE_MIN_DURATION} max={ceiling} value={value.duration} disabled={disabled}
            onChange={(e) => set({ duration: Math.min(Math.max(Number(e.target.value) || INSPIRE_MIN_DURATION, INSPIRE_MIN_DURATION), ceiling) })}
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            Seed <InfoTip text="Fix a seed to reproduce the same take. Leave blank for a random result." />
          </p>
          <input type="number" min={1} value={value.seed} disabled={disabled}
            onChange={(e) => set({ seed: e.target.value })} placeholder="Random"
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
      </div>
    </div>
  );
}