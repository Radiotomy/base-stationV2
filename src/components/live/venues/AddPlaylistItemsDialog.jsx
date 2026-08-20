import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import AssetPicker from '@/components/studio/AssetPicker';

const KINDS = [
  { type: 'track', label: 'Tracks', media: 'audio' },
  { type: 'master', label: 'Masters', media: 'audio' },
  { type: 'video', label: 'Music Videos', media: 'video' },
  { type: 'visualizer', label: 'Visualizers', media: 'video' },
];

/**
 * Add entries to a venue programme from the creator's own library.
 *
 * Each entry records the source asset's media kind and duration at add time,
 * because the programme clock sums durations to know what is on air — an entry
 * without one would make the whole loop's timing guesswork.
 */
export default function AddPlaylistItemsDialog({ open, onOpenChange, onAdd }) {
  const [kindIndex, setKindIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const kind = KINDS[kindIndex];

  const add = async () => {
    if (!selected.length) { toast.error('Pick at least one item'); return; }
    setBusy(true);
    try {
      const rows = await Promise.all(selected.map((id) => base44.entities.UserAsset.filter({ id })));
      const items = rows
        .map((r) => r?.[0])
        .filter((a) => a?.file_url)
        .map((a) => ({
          asset_id: a.id,
          media_kind: kind.media,
          title: a.title || 'Untitled',
          file_url: a.file_url,
          thumbnail_url: a.thumbnail_url || '',
          duration_seconds: Math.round(
            Number(a.metadata?.duration_seconds) || Number(a.metadata?.duration) || 0,
          ),
        }));
      if (!items.length) throw new Error('Those items have no playable file');
      onAdd(items);
      setSelected([]);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to programme</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {KINDS.map((k, i) => (
              <button key={k.type} type="button"
                onClick={() => { setKindIndex(i); setSelected([]); }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  i === kindIndex ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}>
                {k.label}
              </button>
            ))}
          </div>
          <AssetPicker key={kind.type} assetType={kind.type} multi max={12}
            selected={selected} onChange={setSelected} />
          <Button onClick={add} disabled={busy || !selected.length}
            className="w-full rounded-xl font-bold gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add {selected.length || ''} {selected.length === 1 ? 'item' : 'items'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}