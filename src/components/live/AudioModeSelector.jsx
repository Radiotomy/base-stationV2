import { Radio, Music2 } from 'lucide-react';

/**
 * Phase 5.6 — Audio Mode selector for the LiveStudio setup panel.
 * Two options:
 *   "streamr" → true live audio (requires STREAMR_PRIVATE_KEY server-side)
 *   "sync"    → synchronized playback (each fan plays the same track_url locally)
 *
 * Pure UI; no transport wiring.
 */
export default function AudioModeSelector({ value = 'sync', onChange, disabled = false, streamrAvailable = true }) {
  const options = [
    {
      id: 'sync',
      label: 'Synchronized Playback',
      sub: 'Shared track — each fan plays the same audio locally',
      icon: Music2,
      color: 'text-emerald-400',
      ring: 'ring-emerald-500/50 border-emerald-500/40 bg-emerald-500/5',
    },
    {
      id: 'streamr',
      label: 'True Live Audio',
      sub: streamrAvailable ? 'Broadcast your mic via Streamr' : 'Streamr not configured',
      icon: Radio,
      color: 'text-cyan-400',
      ring: 'ring-cyan-500/50 border-cyan-500/40 bg-cyan-500/5',
      disabled: !streamrAvailable,
    },
  ];

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-muted-foreground uppercase">Audio Mode</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(opt => {
          const Icon = opt.icon;
          const selected = value === opt.id;
          const isDisabled = disabled || opt.disabled;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => !isDisabled && onChange?.(opt.id)}
              disabled={isDisabled}
              className={`text-left p-3 rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                selected ? `ring-1 ${opt.ring}` : 'border-border bg-muted/30 hover:bg-muted/60'
              }`}
              title={isDisabled ? opt.sub : undefined}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${opt.color}`} />
                <p className="text-xs font-bold text-foreground">{opt.label}</p>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">{opt.sub}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}