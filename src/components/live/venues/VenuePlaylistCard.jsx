import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Save, Trash2, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import PlaylistItemRow from './PlaylistItemRow';
import AddPlaylistItemsDialog from './AddPlaylistItemsDialog';

/**
 * One programme (playlist) inside a venue's idle content tab.
 *
 * Edits are staged locally and saved explicitly: reordering a live programme
 * key-by-key would restart the venue's on-air clock on every keystroke.
 */
export default function VenuePlaylistCard({ playlist, siblings = [], onChanged }) {
  const [title, setTitle] = useState(playlist.title || '');
  const [items, setItems] = useState(playlist.items || []);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const dirty = title !== playlist.title || JSON.stringify(items) !== JSON.stringify(playlist.items || []);
  const totalSeconds = items.reduce((s, i) => s + (Number(i.duration_seconds) || 180), 0);

  const move = (index, delta) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      await base44.entities.VenuePlaylist.update(playlist.id, { title: title.trim() || 'Untitled', items });
      toast.success('Programme saved');
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  const makeDefault = async () => {
    setBusy(true);
    try {
      // Only one loop can be the fallback, so the flag is moved rather than added
      // — two defaults would leave which one plays down to update order.
      await Promise.all(
        siblings
          .filter((p) => p.id !== playlist.id && p.is_default_loop)
          .map((p) => base44.entities.VenuePlaylist.update(p.id, { is_default_loop: false })),
      );
      await base44.entities.VenuePlaylist.update(playlist.id, { is_default_loop: true });
      onChanged?.();
      toast.success('Set as the venue\'s default loop');
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await base44.entities.VenuePlaylist.delete(playlist.id);
      onChanged?.();
      toast.success('Programme deleted');
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          className="rounded-xl h-9 flex-1 min-w-[160px] font-bold" placeholder="Programme name" />
        {playlist.is_default_loop
          ? <Badge className="gap-1 text-[10px] flex-shrink-0"><Repeat className="w-3 h-3" /> Default loop</Badge>
          : (
            <Button size="sm" variant="outline" onClick={makeDefault} disabled={busy}
              className="rounded-lg h-9 text-xs gap-1.5">
              <Repeat className="w-3.5 h-3.5" /> Make default
            </Button>
          )}
        <button type="button" onClick={remove} disabled={busy}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive flex-shrink-0" aria-label="Delete programme">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {items.length} {items.length === 1 ? 'item' : 'items'} · {Math.floor(totalSeconds / 60)} min loop
      </p>

      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Nothing programmed yet — add tracks and videos to fill this channel.
          </p>
        )}
        {items.map((item, i) => (
          <PlaylistItemRow key={`${item.asset_id}-${i}`} item={item} index={i} total={items.length}
            onMove={move} onRemove={(idx) => setItems(items.filter((_, n) => n !== idx))} />
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}
          className="rounded-xl h-9 text-xs gap-1.5 flex-1">
          <Plus className="w-3.5 h-3.5" /> Add items
        </Button>
        <Button size="sm" onClick={save} disabled={busy || !dirty}
          className="rounded-xl h-9 text-xs gap-1.5 flex-1 font-bold">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>

      <AddPlaylistItemsDialog open={adding} onOpenChange={setAdding}
        onAdd={(newItems) => setItems([...items, ...newItems])} />
    </div>
  );
}