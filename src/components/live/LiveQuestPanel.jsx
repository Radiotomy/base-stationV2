import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

/**
 * Phase 4 — Live Quest panel.
 * Performer view: create quests.
 * Fan view: progress bar + reward animation.
 */
export default function LiveQuestPanel({ sessionId, isPerformer = false, currentUserId }) {
  const [quests, setQuests] = useState([]);
  const [open, setOpen] = useState(false);
  const [questType, setQuestType] = useState('reaction');
  const [target, setTarget] = useState(10);
  const [rewardXp, setRewardXp] = useState(50);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    if (!sessionId) return;
    base44.entities.LiveQuest.filter({ session_id: sessionId, status: 'active' }, '-created_date', 10)
      .then(setQuests).catch(() => {});
  };

  useEffect(() => {
    refresh();
    if (!sessionId) return;
    const unsub = base44.entities.LiveQuest.subscribe(() => refresh());
    return unsub;
  }, [sessionId]);

  const createQuest = async () => {
    if (!sessionId) return;
    setCreating(true);
    try {
      const me = await base44.auth.me();
      await base44.entities.LiveQuest.create({
        session_id: sessionId,
        performer_id: me.id,
        title: title || `${questType} quest`,
        quest_type: questType,
        target: Number(target),
        reward_xp: Number(rewardXp),
        status: 'active',
        progress: {},
        completers: [],
      });
      toast.success('Quest created!');
      setOpen(false);
      setTitle('');
      refresh();
    } catch (e) {
      toast.error('Failed to create quest');
    } finally {
      setCreating(false);
    }
  };

  if (!sessionId) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-black text-foreground">Fan Quests</h3>
        {isPerformer && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="ml-auto h-7 rounded-lg text-xs gap-1">
                <Plus className="w-3 h-3" /> New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Fan Quest</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Quest title (e.g., Hype Squad)" value={title} onChange={e => setTitle(e.target.value)} />
                <Select value={questType} onValueChange={setQuestType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reaction">Send N reactions</SelectItem>
                    <SelectItem value="chat">Send N chat messages</SelectItem>
                    <SelectItem value="stay_duration">Stay N seconds</SelectItem>
                    <SelectItem value="tip">Tip N cents</SelectItem>
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Target</label>
                    <Input type="number" value={target} onChange={e => setTarget(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Reward XP</label>
                    <Input type="number" value={rewardXp} onChange={e => setRewardXp(e.target.value)} />
                  </div>
                </div>
                <Button onClick={createQuest} disabled={creating} className="w-full bg-amber-600 hover:bg-amber-500 gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                  Create Quest
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {quests.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          {isPerformer ? 'Create a quest to engage fans.' : 'No active quests.'}
        </p>
      ) : (
        <div className="space-y-2">
          {quests.map(q => {
            const my = (q.progress?.[currentUserId] || 0);
            const pct = Math.min(100, (my / q.target) * 100);
            const completed = q.completers?.includes(currentUserId);
            return (
              <div key={q.id} className="p-3 rounded-xl bg-muted/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-foreground truncate">{q.title}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{q.quest_type.replace('_', ' ')}</Badge>
                </div>
                <div className="h-1.5 rounded-full bg-background overflow-hidden">
                  <div className={`h-full transition-all ${completed ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{my}/{q.target}{completed && ' ✓'}</span>
                  <span>+{q.reward_xp} XP</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}