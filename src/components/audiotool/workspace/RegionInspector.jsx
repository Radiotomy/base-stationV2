import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SECTIONS } from '@/lib/audiotool/arrangement';

export default function RegionInspector({ region, onEdit, onClose }) {
  const start = Math.round(region.start);
  const length = Math.max(1, Math.round(region.length));
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-accent/40 bg-accent/5 p-3">
      <div className="mr-auto min-w-0">
        <p className="text-sm font-semibold truncate">{region.name}</p>
        <p className="text-xs text-muted-foreground">Bar {start + 1} · {length} bar{length > 1 ? 's' : ''}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={() => onEdit({ start: Math.max(0, start - 1) })} aria-label="Move left"><ChevronLeft className="w-4 h-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => onEdit({ start: start + 1 })} aria-label="Move right"><ChevronRight className="w-4 h-4" /></Button>
        <Button size="sm" variant="outline" disabled={length <= 1} onClick={() => onEdit({ length: length - 1 })} aria-label="Shorten"><Minus className="w-4 h-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => onEdit({ length: length + 1 })} aria-label="Extend"><Plus className="w-4 h-4" /></Button>
      </div>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        Section
        <select value={SECTIONS.includes(region.name) ? region.name : ''} onChange={(e) => e.target.value && onEdit({ name: e.target.value })}
          className="h-8 rounded-md border border-input bg-popover px-2 text-sm normal-case tracking-normal text-foreground">
          <option value="">Label…</option>
          {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></Button>
    </div>
  );
}