import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

export default function ExplorerTrackRow({ track, disabled, onToggle }) {
  const enabled = track.entity.fields.isEnabled;
  return (
    <div className="rounded-xl bg-secondary/60 px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">{track.kind}</Badge>
        <span className="text-sm font-medium truncate flex-1">{track.name}</span>
        {enabled && (
          <Switch checked={enabled.value} disabled={disabled} onCheckedChange={(v) => onToggle(enabled, v)}
            aria-label={enabled.value ? 'Disable track' : 'Enable track'} />
        )}
      </div>
      {track.regions.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No regions</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {track.regions.map((r) => (
            <span key={r.id} className="text-[11px] rounded-md border border-border px-1.5 py-0.5 text-muted-foreground">
              {r.name} · bar {r.bar} · {r.bars} bar{r.bars > 1 ? 's' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}