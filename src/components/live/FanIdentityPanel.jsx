import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Heart, Trophy, Sparkles, Zap, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AudiusIdentityBadge from '@/components/audius/AudiusIdentityBadge';

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

      {/* Phase 5 — XP multiplier indicator */}
      {xp?.xp_multiplier > 1 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <Zap className="w-3 h-3 text-yellow-300" />
          <span className="text-xs font-bold text-yellow-300">{xp.xp_multiplier}× XP boost</span>
          <span className="text-[10px] text-muted-foreground ml-auto">Fan Club</span>
        </div>
      )}

      {currentUser.metadata?.audius && (
        <AudiusIdentityBadge audius={currentUser.metadata.audius} compact />
      )}

      {/* Phase 5 — Audius collectibles preview */}
      {currentUser.metadata?.audius?.collectibles?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
            <Award className="w-3 h-3" /> Audius Collectibles
          </p>
          <div className="flex gap-1 overflow-x-auto">
            {currentUser.metadata.audius.collectibles.slice(0, 6).map((c, i) => (
              <div key={i} className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-muted" title={c.name}>
                {c.imageUrl
                  ? <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                  : <Award className="w-3 h-3 m-auto mt-2 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {performerId && performerId !== currentUser.id && (
        <Button onClick={onTipClick} className="w-full rounded-xl bg-pink-600 hover:bg-pink-500 gap-2 text-sm font-bold">
          <Heart className="w-4 h-4" /> Tip Performer
        </Button>
      )}
    </div>
  );
}