import { Badge } from '@/components/ui/badge';

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-secondary/60 px-3 py-2">
    <div className="text-lg font-bold">{value}</div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
  </div>
);

/** What the BASE Engine backend parsed natively from the project's binary state. */
export default function AudiotoolIngestSummary({ summary }) {
  const types = Object.entries(summary.entity_type_counts || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Entities parsed" value={summary.entity_count} />
        <Stat label="MIDI notes" value={summary.notes.length} />
        <Stat label="Automation points" value={summary.automation_events.length} />
        <Stat label="Cables" value={summary.cables.length} />
        <Stat label="Tracks" value={summary.tracks.length} />
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