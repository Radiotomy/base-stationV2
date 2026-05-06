import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Gift, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

/**
 * Phase 5 — Reward top fans of the current creator.
 */
export default function RewardFansModal() {
  const [open, setOpen] = useState(false);
  const [criteria, setCriteria] = useState('top_reactors');
  const [limit, setLimit] = useState(5);
  const [rewardType, setRewardType] = useState('xp');
  const [amount, setAmount] = useState(50);
  const [badgeName, setBadgeName] = useState('superfan');
  const [running, setRunning] = useState(false);

  const submit = async () => {
    setRunning(true);
    try {
      const reward = rewardType === 'xp'
        ? { type: 'xp', amount: Number(amount) }
        : { type: 'badge', badge_name: badgeName.trim() };
      const r = await base44.functions.invoke('rewardFans', { criteria, limit: Number(limit), reward });
      const rewarded = r?.data?.data?.rewarded || r?.data?.rewarded || [];
      toast.success(`Rewarded ${rewarded.length} fan${rewarded.length === 1 ? '' : 's'}`);
      setOpen(false);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Reward failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
          <Gift className="w-4 h-4" /> Reward Fans
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reward Top Fans</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Criteria</label>
            <Select value={criteria} onValueChange={setCriteria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="top_reactors">Top Reactors</SelectItem>
                <SelectItem value="top_chatters">Top Chatters</SelectItem>
                <SelectItem value="top_tippers">Top Tippers</SelectItem>
                <SelectItem value="longest_watch">Longest Watch Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">How many fans?</label>
              <Input type="number" value={limit} onChange={e => setLimit(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Reward Type</label>
              <Select value={rewardType} onValueChange={setRewardType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="xp">XP Bonus</SelectItem>
                  <SelectItem value="badge">Badge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {rewardType === 'xp' ? (
            <div>
              <label className="text-xs text-muted-foreground">XP per fan</label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          ) : (
            <div>
              <label className="text-xs text-muted-foreground">Badge name</label>
              <Input value={badgeName} onChange={e => setBadgeName(e.target.value)} />
            </div>
          )}
          <Button onClick={submit} disabled={running} className="w-full rounded-xl gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            Reward Fans
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}