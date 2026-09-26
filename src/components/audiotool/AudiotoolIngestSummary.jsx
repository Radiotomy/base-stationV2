import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-secondary/60 px-3 py-2">
    <div className="text-lg font-bold">{value}</div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
  </div>
);

/** What the BASE Engine backend parsed natively from the project's binary state. */
export default function AudiotoolIngestSummary({ summary, at }) {
  const types = Object.entries(summary.entity_type_counts || {}).sort((a, b) => b[1] - a[1]);
  const count = summary.entity_count ?? 0;
  return (
    <div className="space-y-3 rounded-xl border border-emerald-400/40 p-4">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold">BASE Engines received your session{at ? ` · ${at.toLocaleTimeString()}` : ''}</p>
          <p className="text-xs text-muted-foreground">
            {count > 0
              ? `The engine read ${count} project parts straight from Audiotool. This is a read-only snapshot — nothing in your project was changed.`
              : 'The engine connected, but Audiotool returned an empty project. Add something to the project and send again.'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Entities parsed" value={count} />
        <Stat label="MIDI notes" value={summary.notes?.length ?? 0} />
        <Stat label="Automation points" value={summary.automation_events?.length ?? 0} />
        <Stat label="Cables" value={summary.cables?.length ?? 0} />
        <Stat label="Tracks" value={summary.tracks?.length ?? 0} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {types.map(([t, n]) => <Badge key={t} variant="secondary">{t} · {n}</Badge>)}
      </div>
      {summary.unknown_types?.length > 0 && (
        <p className="text-xs text-amber-300">
          {summary.unknown_types.length} entity type(s) are newer than the engine's bindings and were skipped.
        </p>
      )}
      {summary.truncated && <p className="text-xs text-muted-foreground">Lists above are capped; the engine holds the full state.</p>}
    </div>
  );
}