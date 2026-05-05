import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Heart, Trophy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Compact identity panel for the LiveWatch sidebar.
 * Shows the current fan's XP/level, badge count, follow status, and a Tip button.
 */
export default function FanIdentityPanel({ currentUser, performerId, performerName, performerEmail, onTipClick }) {
  const [xp, setXp] = useState(null);
  const [badgeCount, setBadgeCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    base44.entities.UserXP.filter({ user_id: currentUser.id }).then(r => setXp(r[0])).catch(() => {});
    base44.entities.UserBadge.filter({ user_id: currentUser.id }).then(r => setBadgeCount(r.length)).catch(() => {});
    if (performerId) {
      base44.entities.Follow.filter({ follower_id: currentUser.id, following_id: performerId })
        .then(r => setIsFollowing(r.length > 0)).catch(() => {});
    }
  }, [currentUser?.id, performerId]);

  if (!currentUser) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-sm font-black text-white">
          {(currentUser.full_name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{currentUser.full_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge className="bg-yellow-500/20 text-yellow-300 border-0 text-xs px-1.5 py-0">
              <Sparkles className="w-3 h-3 mr-0.5" /> Lv {xp?.level || 1}
            </Badge>
            <span className="text-xs text-muted-foreground">{xp?.total_xp || 0} XP</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Trophy className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-muted-foreground">{badgeCount} badge{badgeCount !== 1 ? 's' : ''}</span>
        {isFollowing && (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-xs ml-auto">Following</Badge>
        )}
      </div>

      {performerId && performerId !== currentUser.id && (
        <Button onClick={onTipClick} className="w-full rounded-xl bg-pink-600 hover:bg-pink-500 gap-2 text-sm font-bold">
          <Heart className="w-4 h-4" /> Tip Performer
        </Button>
      )}
    </div>
  );
}