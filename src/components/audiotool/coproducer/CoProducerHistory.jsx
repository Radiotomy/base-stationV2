import { Button } from '@/components/ui/button';
import { Undo2, Loader2 } from 'lucide-react';

// This session's AI rewrites, newest first, each individually undoable.
export default function CoProducerHistory({ items, busyId, onUndo }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">This session's rewrites</p>
      {items.map((it) => (
        <div key={it.regionId} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-sm">
          <span className="truncate">{it.prompt} <span className="text-muted-foreground">· {it.count} notes · {it.source}</span></span>
          <Button size="sm" variant="ghost" disabled={!!busyId} onClick={() => onUndo(it)}>
            {busyId === it.regionId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Undo
          </Button>
        </div>
      ))}
    </div>
  );
}