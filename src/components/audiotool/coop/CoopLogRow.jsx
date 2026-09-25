import { Loader2, Check, AlertTriangle, Clock } from 'lucide-react';

const ICONS = {
  queued: <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
  generating: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  inserted: <Check className="w-3.5 h-3.5 text-emerald-300" />,
  failed: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />,
};

export default function CoopLogRow({ entry }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
      <span className="mt-0.5">{ICONS[entry.status]}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate"><span className="font-semibold">{entry.user}</span> · {entry.kind} · {entry.prompt}</p>
        <p className="text-xs text-muted-foreground">
          {entry.status === 'inserted' ? `Inserted at bar ${entry.bar}` : entry.status === 'failed' ? entry.error : entry.status}
        </p>
      </div>
    </div>
  );
}