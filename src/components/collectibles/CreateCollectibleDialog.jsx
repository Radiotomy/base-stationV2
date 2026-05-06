import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import AssetPicker from '@/components/studio/AssetPicker';
import { toast } from 'sonner';

/**
 * Phase 5 — Creator-only dialog for creating a new collectible.
 * Excludes Loudly-origin assets (legal gate).
 */
export default function CreateCollectibleDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [supply, setSupply] = useState('');
  const [claimType, setClaimType] = useState('free');
  const [priceUsd, setPriceUsd] = useState(0);
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      await base44.functions.invoke('createCollectible', {
        name: name.trim(),
        description,
        media_asset_id: selected[0] || null,
        supply: supply ? Number(supply) : null,
        claim_type: claimType,
        price_usd: Number(priceUsd) || 0,
      });
      toast.success('Collectible created');
      setOpen(false); setName(''); setDescription(''); setSupply(''); setSelected([]);
      onCreated?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl gap-1.5 bg-purple-600 hover:bg-purple-500">
          <Plus className="w-3.5 h-3.5" /> New Collectible
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create a Collectible</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <Textarea placeholder="Description (optional)" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Linked Asset (optional, no Loudly)</label>
            <AssetPicker
              assetType="track"
              selected={selected}
              onChange={setSelected}
              excludeOrigins={['loudly']}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Supply</label>
              <Input type="number" placeholder="∞" value={supply} onChange={e => setSupply(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <Select value={claimType} onValueChange={setClaimType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="quest">Quest</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="live_drop">Live Drop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Price USD</label>
              <Input type="number" value={priceUsd} onChange={e => setPriceUsd(e.target.value)} disabled={claimType !== 'purchase'} />
            </div>
          </div>
          <Button onClick={submit} disabled={creating} className="w-full rounded-xl gap-2 bg-purple-600 hover:bg-purple-500">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}