import { Music, Film, ArrowUp, ArrowDown, X } from 'lucide-react';

function fmt(seconds) {
  const s = Math.round(Number(seconds) || 0);
  if (!s) return '3:00 est.';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function PlaylistItemRow({ item, index, total, onMove, onRemove }) {
  const Icon = item.media_kind === 'video' ? Film : Music;
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card">
      <span className="text-[10px] font-mono text-muted-foreground w-5 text-right flex-shrink-0">{index + 1}</span>
      <div className="w-9 h-9 rounded-lg bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
        {item.thumbnail_url
          ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
          : <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
        <p className="text-[10px] text-muted-foreground capitalize">{item.media_kind} · {fmt(item.duration_seconds)}</p>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-25" aria-label="Move up">
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-25" aria-label="Move down">
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onRemove(index)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive" aria-label="Remove">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}