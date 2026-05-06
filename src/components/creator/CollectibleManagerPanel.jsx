import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Award, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import AssetPicker from '@/components/studio/AssetPicker';

/**
 * Phase 5 — Creator-facing collectible manager.
 * Used in CreatorDashboard.
 */
export default function CollectibleManagerPanel() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', supply: '', claim_type: 'free', media_asset_id: '' });

  const load = async () => {
    const me = await base44.auth.me().catch(() => null);
    setUser(me);
    if (!me) return;
    const r = await base44.functions.invoke('getCollectiblesForCreator', { creatorId: me.id }).catch(() => null);
    setItems(r?.data?.data?.collectibles || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      await base44.functions.invoke('createCollectible', {
        name: form.name,
        description: form.description,
        media_asset_id: form.media_asset_id || null,
        supply: form.supply ? parseInt(form.supply, 10) : null,
        claim_type: form.claim_type,
      });
      toast.success('Collectible created');
      setOpen(false);
      setForm({ name: '', description: '', supply: '', claim_type: 'free', media_asset_id: '' });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4 text-yellow-400" />
        <h3 className="font-black text-sm">Collectibles</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="ml-auto rounded-xl bg-purple-600 hover:bg-purple-500 gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Collectible</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Textarea placeholder="Description" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Supply (optional)" value={form.supply} onChange={e => setForm({ ...form, supply: e.target.value })} />
                <select value={form.claim_type} onChange={e => setForm({ ...form, claim_type: e.target.value })}
                  className="rounded-md bg-background border border-input px-3 text-sm">
                  <option value="free">Free claim</option>
                  <option value="quest">Quest reward</option>
                  <option value="live_drop">Live drop</option>
                  <option value="purchase">Purchase</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Linked asset (creator-origin or Audius only)</p>
                <AssetPicker
                  assetType="track"
                  selected={form.media_asset_id ? [form.media_asset_id] : []}
                  onChange={(ids) => setForm({ ...form, media_asset_id: ids[0] || '' })}
                  excludeOrigins={['loudly']}
                />
              </div>
              <Button onClick={create} disabled={creating} className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 gap-2">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No collectibles yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {items.map(c => (
            <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-purple-700 to-indigo-800 flex-shrink-0 flex items-center justify-center">
                {c.media_url ? <img src={c.media_url} alt="" className="w-full h-full object-cover" /> : <Award className="w-3.5 h-3.5 text-white/50" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{c.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[10px] capitalize px-1 py-0">{c.claim_type}</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {c.supply ? `${c.claimed_count || 0}/${c.supply}` : `${c.claimed_count || 0} claimed`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}