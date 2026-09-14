import { Input } from '@/components/ui/input';
import { SONIC_VOCAL_GENDER_MODELS } from '@/config/musicModelCatalog';

/**
 * Sonic-only steering controls (docs.aimusicapi.ai, audited 2026-09-03):
 * vocal_gender · make_instrumental · negative_tags · style_weight · weirdness_constraint.
 * `value` is a flat object; unset keys are simply not sent.
 */
export default function SonicStyleControls({ model, value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const genderOk = SONIC_VOCAL_GENDER_MODELS.includes(model);
  const chip = (active) => `px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${active ? 'bg-cyan-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Vocals</p>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => set({ instrumental: false, vocal_gender: null })} className={chip(!value.instrumental && !value.vocal_gender)}>Auto</button>
          <button disabled={!genderOk} onClick={() => set({ instrumental: false, vocal_gender: 'f' })} className={`${chip(value.vocal_gender === 'f')} disabled:opacity-40`}>Female</button>
          <button disabled={!genderOk} onClick={() => set({ instrumental: false, vocal_gender: 'm' })} className={`${chip(value.vocal_gender === 'm')} disabled:opacity-40`}>Male</button>
          <button onClick={() => set({ instrumental: true, vocal_gender: null })} className={chip(!!value.instrumental)}>Instrumental</button>
        </div>
        {!genderOk && <p className="text-[10px] text-muted-foreground mt-1">Vocal gender needs Sonic v4.5 or newer.</p>}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Avoid (negative tags)</p>
        <Input value={value.negative_tags || ''} onChange={(e) => set({ negative_tags: e.target.value })}
          placeholder="e.g. acoustic, slow, country" className="rounded-xl text-sm" maxLength={200} />
      </div>

      {[
        { key: 'style_weight', label: 'Style adherence', hint: 'how strongly tags steer the sound' },
        { key: 'weirdness_constraint', label: 'Experimental', hint: 'higher = more unusual output' },
      ].map(({ key, label, hint }) => (
        <div key={key}>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
            {label} — <span className="text-foreground">{value[key] == null ? 'Auto' : value[key].toFixed(2)}</span>
            <span className="normal-case font-normal"> · {hint}</span>
          </p>
          <input type="range" min={0} max={1} step={0.05} value={value[key] ?? 0.5}
            onChange={(e) => set({ [key]: Number(e.target.value) })} className="w-full accent-cyan-500" />
        </div>
      ))}
    </div>
  );
}