import { Zap, Award, Crown, PenLine } from 'lucide-react';

const MODES = [
  {
    key: 'manual',
    icon: PenLine,
    label: 'Manual Writer',
    desc: 'Write it yourself — paste from anywhere, basic AI assist',
    cost: 'free',
    activeClass: 'border-emerald-500 bg-emerald-500/10',
    iconActive: 'text-emerald-400',
    labelActive: 'text-emerald-300',
  },
  {
    key: 'basic',
    icon: Zap,
    label: 'Basic',
    desc: 'Quick AI lyrics from topic, mood & style',
    cost: '2 credits',
    activeClass: 'border-pink-500 bg-pink-500/10',
    iconActive: 'text-pink-400',
    labelActive: 'text-pink-300',
  },
  {
    key: 'pro',
    icon: Award,
    label: 'Pro Songwriter',
    desc: 'Nashville/LA-grade rhyme craft + writer-style auto-fill',
    cost: '2 credits',
    activeClass: 'border-amber-500 bg-amber-500/10',
    iconActive: 'text-amber-400',
    labelActive: 'text-amber-300',
  },
  {
    key: 'masters',
    icon: Crown,
    label: '243 Masters',
    desc: 'Lyrics + chords + arrangement + production brief',
    cost: '3 credits',
    activeClass: 'border-amber-400 bg-gradient-to-r from-amber-500/15 to-purple-500/15',
    iconActive: 'text-amber-300',
    labelActive: 'text-amber-200',
  },
];

/**
 * Segmented Basic / Pro / Masters engine selector for the Lyrics Studio.
 * One studio, three power levels.
 */
export default function EngineModeSelector({ mode, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase">Engine</label>
      <div className="space-y-1.5">
        {MODES.map(m => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onChange(m.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${active ? m.activeClass : 'bg-muted/30 border-border hover:border-amber-500/30'}`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? m.iconActive : 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-black ${active ? m.labelActive : 'text-foreground'}`}>{m.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{m.desc}</p>
              </div>
              <span className={`text-[10px] font-bold flex-shrink-0 ${active ? m.labelActive : 'text-muted-foreground/60'}`}>{m.cost}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}