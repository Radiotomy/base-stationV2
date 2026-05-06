import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Gift, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

/**
 * Phase 5 — "Reward Fans" modal for the Creator Dashboard.
 */
export default function RewardFansModal() {
  const [open, setOpen] = useState(false);
  const [criteria, setCriteria] = useState('top_reactors');
  const [limit, setLimit] = useState(5);
  const [rewardType, setRewardType] = useState('xp');
  const [xpAmount, setXpAmount] = useState(50);
  const [badgeName, setBadgeName] = useState('super_fan');
  const [collectibleId, setCollectibleId] = useState('');
  const [collectibles, setCollectibles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    base44.auth.me().then(me => {
      base44.functions.invoke('getCollectiblesForCreator', { creatorId: me.id })
        .then(r => setCollectibles(r.data?.data?.collectibles || []))
        .catch(() => {});
    }).catch(() => {});
  }, [open]);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const reward = rewardType === 'xp'
        ? { type: 'xp', amount: parseInt(xpAmount, 10) }
        : rewardType === 'badge'
        ? { type: 'badge', badgeName }
        : { type: 'collectible', collectibleId };
      const r = await base44.functions.invoke('rewardFans', { criteria, limit: parseInt(limit, 10), reward });
      setResult(r.data?.data);
      toast.success(`Rewarded ${r.data?.data?.rewarded?.length || 0} fan(s)`);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Reward failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl bg-pink-600 hover:bg-pink-500 gap-2 font-bold">
          <Gift className="w-4 h-4" /> Reward Fans
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reward Top Fans</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Criteria</label>
            <select value={criteria} onChange={e => setCriteria(e.target.value)}
              className="w-full rounded-md bg-background border border-input px-3 h-9 text-sm">
              <option value="top_reactors">Top Reactors</option>
              <option value="top_chatters">Top Chatters</option>
              <option value="top_tippers">Top Tippers</option>
              <option value="top_watch_time">Longest Watch Time</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">How many fans</label>
            <Input type="number" value={limit} onChange={e => setLimit(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Reward Type</label>
            <select value={rewardType} onChange={e => setRewardType(e.target.value)}
              className="w-full rounded-md bg-background border border-input px-3 h-9 text-sm">
              <option value="xp">XP</option>
              <option value="badge">Badge</option>
              <option value="collectible">Collectible</option>
            </select>
          </div>
          {rewardType === 'xp' && (
            <Input type="number" placeholder="XP amount" value={xpAmount} onChange={e => setXpAmount(e.target.value)} />
          )}
          {rewardType === 'badge' && (
            <Input placeholder="Badge name (slug)" value={badgeName} onChange={e => setBadgeName(e.target.value)} />
          )}
          {rewardType === 'collectible' && (
            <select value={collectibleId} onChange={e => setCollectibleId(e.target.value)}
              className="w-full rounded-md bg-background border border-input px-3 h-9 text-sm">
              <option value="">— pick a collectible —</option>
              {collectibles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          <Button onClick={handleSubmit} disabled={busy} className="w-full rounded-xl bg-pink-600 hover:bg-pink-500 gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Distribute Rewards
          </Button>

          {result?.rewarded && (
            <div className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto pt-2 border-t border-border">
              {result.rewarded.length === 0 && <p>{result.note || 'No fans matched criteria.'}</p>}
              {result.rewarded.map((f, i) => (
                <p key={i}>✅ {f.user_name} — {f.awarded?.type}{f.awarded?.amount ? ` (${f.awarded.amount})` : ''}</p>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}