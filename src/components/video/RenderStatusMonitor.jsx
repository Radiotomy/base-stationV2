import { Loader2, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';

// Shotstack's render lifecycle, in the order the API reports it.
const PHASES = [
  { key: 'queued', label: 'Queued' },
  { key: 'fetching', label: 'Fetching media' },
  { key: 'rendering', label: 'Rendering' },
  { key: 'saving', label: 'Saving' },
  { key: 'done', label: 'Ready' },
];

/**
 * Live render status for Shotstack exports — shows exactly which phase the
 * render is in (as reported by the provider), not just a spinner.
 *
 * Props: stage (provider phase), status ('processing'|'completed'|'failed'),
 *        elapsedSeconds, label
 */
export default function RenderStatusMonitor({ stage, status, elapsedSeconds = 0, label = 'Render status' }) {
  const failed = status === 'failed';
  const activeIndex = status === 'completed'
    ? PHASES.length - 1
    : Math.max(0, PHASES.findIndex((p) => p.key === stage));

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
        </span>
      </div>

      <div className="space-y-1.5">
        {PHASES.map((phase, i) => {
          const done = i < activeIndex || status === 'completed';
          const active = i === activeIndex && status === 'processing';
          return (
            <div key={phase.key} className="flex items-center gap-2">
              {failed && active ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              ) : done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : active ? (
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />
              )}
              <span className={`text-xs ${done ? 'text-emerald-300' : active ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}