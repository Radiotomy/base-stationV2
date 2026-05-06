import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Users, Crown, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import TierComparisonGrid from '@/components/fanclub/TierComparisonGrid';

/**
 * Phase 5 — Fan Club page for a specific creator.
 * Route: /fanclub/:creatorId
 */
export default function FanClub() {
  const { creatorId } = useParams();
  const [user, setUser] = useState(null);
  const [club, setClub] = useState(null);
  const [membership, setMembership] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyTierId, setBusyTierId] = useState(null);
  const [creatingDefault, setCreatingDefault] = useState(false);

  const load = async () => {
    setLoading(true);
    const me = await base44.auth.me().catch(() => null);
    setUser(me);

    const [profileRows, clubRes] = await Promise.all([
      base44.entities.ArtistProfile.filter({ user_id: creatorId }),
      base44.functions.invoke('getFanClubForCreator', { creatorId }),
    ]);
    setProfile(profileRows[0] || null);
    setClub(clubRes.data?.data?.club || null);
    setMembership(clubRes.data?.data?.membership || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [creatorId]);

  const isOwner = user && user.id === creatorId;

  const handleCreateDefault = async () => {
    setCreatingDefault(true);
    try {
      const r = await base44.functions.invoke('createFanClub', {
        name: `${user.full_name}'s Fan Club`,
        description: 'Support my work and unlock perks',
      });
      setClub(r.data?.data);
      toast.success('Fan club created!');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to create fan club');
    } finally {
      setCreatingDefault(false);
    }
  };

  const handleJoin = async (tierId) => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    setBusyTierId(tierId);
    try {
      const r = await base44.functions.invoke('joinFanClubTier', {
        fanclubId: club.id, tierId,
      });
      toast.success(`Joined ${r.data?.data?.tier_name}! ${r.data?.applied_multiplier}× XP active.`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to join');
    } finally {
      setBusyTierId(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to={`/artist/${creatorId}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <Badge variant="outline" className="ml-auto">Phase 5 — Fan Club</Badge>
      </div>

      <div className="relative pt-20 pb-10 px-6 bg-gradient-to-br from-purple-900/40 to-pink-950">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Crown className="w-7 h-7 text-yellow-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight truncate">
              {club?.name || (profile?.display_name ? `${profile.display_name}'s Fan Club` : 'Fan Club')}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {club?.description || 'Become a member and unlock exclusive perks'}
            </p>
          </div>
          {club && (
            <div className="hidden md:flex items-center gap-1.5 text-white/70 text-sm">
              <Users className="w-4 h-4" /> {club.member_count || 0} members
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {!club && isOwner && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">You haven't created your fan club yet.</p>
            <Button onClick={handleCreateDefault} disabled={creatingDefault}
              className="rounded-xl bg-purple-600 hover:bg-purple-500 font-bold gap-2">
              {creatingDefault && <Loader2 className="w-4 h-4 animate-spin" />}
              Create My Fan Club
            </Button>
          </div>
        )}

        {!club && !isOwner && (
          <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
            <p className="text-muted-foreground">This creator hasn't launched a fan club yet.</p>
          </div>
        )}

        {club && (
          <>
            {membership && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-emerald-300" />
                <p className="text-sm text-emerald-200">
                  You're a <strong>{membership.tier_name}</strong> member · {membership.xp_multiplier || 1}× XP active
                </p>
              </div>
            )}

            <TierComparisonGrid
              tiers={club.tiers || []}
              activeTierId={membership?.tier_id}
              onJoin={handleJoin}
              busyTierId={busyTierId}
              disabled={isOwner}
            />
          </>
        )}
      </div>
    </div>
  );
}