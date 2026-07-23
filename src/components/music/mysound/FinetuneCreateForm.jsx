import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ShieldAlert, Music } from 'lucide-react';
import { toast } from 'sonner';

const MAX_TRACKS = 20;

export default function FinetuneCreateForm({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [assets, setAssets] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const list = await base44.entities.UserAsset.filter(
        { user_id: me.id, asset_type: 'track' }, '-created_date', 100
      );
      setAssets(list.filter(a => a.file_url));
      setLoadingAssets(false);
    })();
  }, []);

  const toggle = (id) => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id)
      : prev.length >= MAX_TRACKS ? prev : [...prev, id]
  );

  const handleSubmit = async () => {
    if (name.trim().length < 5) return toast.error('Name must be at least 5 characters');
    if (!genre.trim()) return toast.error('Enter a primary genre');
    if (selectedIds.length === 0) return toast.error('Select at least one track');
    setSubmitting(true);
    try {
      const tracks = assets.filter(a => selectedIds.includes(a.id))
        .map(a => ({ url: a.file_url, title: a.title, asset_id: a.id }));
      const res = await base44.functions.invoke('createMusicFinetune', {
        name: name.trim(), primary_genre: genre.trim(), tracks,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Training started — your sound profile will be ready in ~5-10 minutes');
      onCreated();
    } catch (e) {
      toast.error(e.response?.data?.message || e.response?.data?.error || e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <h3 className="font-bold text-foreground">Train a new sound profile</h3>

      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Only upload music you fully own.</strong> Every track is screened by a third-party copyright check before training.
          If screening fails, the finetune is rejected and the 25-credit training cost is <strong>not refunded</strong>.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Input placeholder="Profile name (min 5 chars) — e.g. My Lo-Fi Signature" value={name} onChange={e => setName(e.target.value)} maxLength={200} />
        <Input placeholder="Primary genre — e.g. lo-fi, hip-hop, edm" value={genre} onChange={e => setGenre(e.target.value)} maxLength={50} />
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">
          Select training tracks from your library ({selectedIds.length}/{MAX_TRACKS}) — diverse but coherent works best
        </p>
        {loadingAssets ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : assets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">
            No tracks in your library yet — generate or upload tracks first.
          </p>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {assets.map(a => (
              <label key={a.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary/60 cursor-pointer">
                <Checkbox checked={selectedIds.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
                <Music className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground truncate">{a.title}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">Cost: <strong className="text-foreground">25 credits</strong> · trains in ~5-10 min</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || selectedIds.length === 0}>
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : 'Start Training'}
          </Button>
        </div>
      </div>
    </div>
  );
}