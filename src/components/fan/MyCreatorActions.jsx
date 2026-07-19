import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Phase 5 — Shows the current fan's recent FanActions (their support history).
 * Optional creatorMap ({ creator_id: display_name }) renders names + profile links.
 */
export default function MyCreatorActions({ userId, creatorMap = {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    base44.entities.FanAction.filter({ user_id: userId }, '-created_date', 30)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [userId]);

  const labelFor = {
    reaction: 'Reacted', chat: 'Chatted', tip: 'Tipped',
    quest: 'Completed Quest', collectible_claim: 'Claimed', fanclub_join: 'Joined Fan Club',
    follow: 'Followed', watch_time: 'Watched',
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-purple-400" />
        <h3 className="font-black text-sm">Your Creator Actions</h3>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No support activity yet — react, tip, or join a fan club!</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
              <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">{labelFor[r.action_type] || r.action_type}</Badge>
              {creatorMap[r.creator_id] ? (
                <Link to={`/artist/${r.creator_id}`} className="text-muted-foreground hover:text-[#FFC98A] truncate flex-1">
                  {creatorMap[r.creator_id]}
                </Link>
              ) : (
                <span className="text-muted-foreground truncate flex-1">creator: {r.creator_id?.slice(0, 8)}…</span>
              )}
              {r.value != null && <span className="text-foreground font-bold">{r.value}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}