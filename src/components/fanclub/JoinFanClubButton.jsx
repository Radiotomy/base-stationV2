import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Crown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Phase 5 — Compact "Join Fan Club" CTA shown on artist profiles.
 * Resolves whether the creator has a fan club and the current viewer's membership.
 */
export default function JoinFanClubButton({ creatorId }) {
  const [fanclub, setFanclub] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creatorId) return;
    base44.functions.invoke('getFanClubForCreator', { creatorId })
      .then(r => {
        const data = r?.data?.data || r?.data || {};
        setFanclub(data.fanclub || null);
        setMembership(data.membership || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [creatorId]);

  if (loading || !fanclub) return null;

  return (
    <Link to={`/fanclub/${creatorId}`}>
      <Button variant="outline" className="rounded-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-semibold gap-1.5">
        <Crown className="w-4 h-4" />
        {membership ? (
          <>
            {membership.tier_name}
            {membership.xp_multiplier > 1 && (
              <Badge className="bg-amber-500/20 text-amber-300 border-0 text-[10px] ml-1 px-1.5 py-0">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />{membership.xp_multiplier}×
              </Badge>
            )}
          </>
        ) : 'Fan Club'}
      </Button>
    </Link>
  );
}