import { Monitor, Box } from 'lucide-react';

/**
 * Fan-side view selector. Only rendered when session.visual_layer === 'portals'
 * (i.e. the creator enabled the optional 3D stage). Fans default to 'standard'
 * and may switch at any time. Preference persists in local state only.
 */
export default function FanVisualLayerSelector({ value, onChange, disabled }) {
  const opts = [
    { v: 'standard', label: 'Standard', icon: Monitor },
    { v: 'portals', label: '3D Mode', icon: Box },
  ];

  return (
    <div className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase pl-1">View:</span>
      <div className="flex flex-1 gap-1">
        {opts.map(({ v, label, icon: Icon }) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onChange(v)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                active
                  ? 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}