import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, Heart, MessageCircle, DollarSign } from 'lucide-react';

/**
 * Phase 5 — Aggregates FanAction records for a creator and shows a Top Fans leaderboard.
 */
export default function TopFansAnalytics({ creatorId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creatorId) return;
    base44.entities.FanAction.filter({ creator_id: creatorId }, '-created_date', 1000)
      .then(actions => {
        const totals = {};
        for (const a of actions) {
          if (!totals[a.user_id]) totals[a.user_id] = {
            user_id: a.user_id, user_name: a.user_name,
            reactions: 0, chats: 0, tips: 0, total: 0,
          };
          const t = totals[a.user_id];
          if (a.action_type === 'reaction') { t.reactions++; t.total++; }
          else if (a.action_type === 'chat') { t.chats++; t.total++; }
          else if (a.action_type === 'tip') { t.tips += (a.value || 0); t.total++; }
          else t.total++;
        }
        setRows(Object.values(totals).sort((a, b) => b.total - a.total).slice(0, 10));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [creatorId]);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <h3 className="font-black text-sm">Top Fans</h3>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No fan actions yet.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <span className="w-5 text-xs font-black text-muted-foreground text-center">{i + 1}</span>
              <p className="text-xs font-bold flex-1 truncate">{r.user_name || 'Fan'}</p>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Heart className="w-3 h-3" />{r.reactions}</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{r.chats}</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><DollarSign className="w-3 h-3" />{(r.tips / 100).toFixed(0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}