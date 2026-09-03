import { SONIC_TOOL_COSTS } from '@/config/musicModelCatalog';

export const STEM_ENGINES = [
  { id: 'sever', label: 'Sever', cost: 2, stems: 6, desc: 'Our own HTDemucs-6s — vocals, drums, bass, guitar, piano, other. One track at a time.' },
  { id: 'sonic_basic', label: 'Sonic Basic', cost: SONIC_TOOL_COSTS.stems_basic, stems: 2, desc: 'Clean vocal + instrumental split from Sonic.' },
  { id: 'sonic_full', label: 'Sonic Studio', cost: SONIC_TOOL_COSTS.stems_full, stems: 12, desc: '12-track split — adds backing vocals, keys, synth, strings, brass, woodwinds, percussion & FX.' },
];

export default function StemEngineSelector({ value, onChange, needsUpload }) {
  return (
    <div className="space-y-2">
      {STEM_ENGINES.map(e => (
        <button key={e.id} onClick={() => onChange(e.id)}
          className={`w-full p-3 rounded-xl border text-left transition-all ${value === e.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-card hover:border-emerald-500/40'}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">{e.label} <span className="text-muted-foreground font-medium">· {e.stems} stems</span></p>
            <span className="text-[10px] font-bold text-muted-foreground">
              {e.cost + (e.id !== 'sever' && needsUpload ? SONIC_TOOL_COSTS.upload : 0)} cr
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{e.desc}</p>
        </button>
      ))}
      {value !== 'sever' && needsUpload && (
        <p className="text-[11px] text-amber-300">Not a Sonic clip yet — it will be uploaded to Sonic first (+{SONIC_TOOL_COSTS.upload} cr).</p>
      )}
    </div>
  );
}