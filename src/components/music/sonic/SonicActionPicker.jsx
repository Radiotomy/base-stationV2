import { Wand2, Scissors, Mic2, Guitar, Link2 } from 'lucide-react';
import { SONIC_TOOL_COSTS } from '@/config/musicModelCatalog';

export const SONIC_ACTIONS = [
  { id: 'remaster',         label: 'Remaster',         icon: Wand2,    desc: 'Polish loudness & clarity, arrangement intact' },
  { id: 'replace_section',  label: 'Replace Section',  icon: Scissors, desc: 'Regenerate one verse or chorus, keep the rest' },
  { id: 'add_vocals',       label: 'Add Vocals',       icon: Mic2,     desc: 'Sing new lyrics over an instrumental' },
  { id: 'add_instrumental', label: 'Add Instrumental', icon: Guitar,   desc: 'Build a backing track under a vocal' },
  { id: 'concat',           label: 'Stitch Full Song', icon: Link2,    desc: 'Join an extension into one continuous file' },
];

export default function SonicActionPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {SONIC_ACTIONS.map(a => (
        <button key={a.id} onClick={() => onChange(a.id)}
          className={`p-3 rounded-xl border text-left transition-all ${value === a.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-border bg-card hover:border-cyan-500/40'}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold flex items-center gap-1.5"><a.icon className="w-4 h-4 text-cyan-400" /> {a.label}</p>
            <span className="text-[10px] font-bold text-muted-foreground">{SONIC_TOOL_COSTS[a.id]} cr</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
        </button>
      ))}
    </div>
  );
}