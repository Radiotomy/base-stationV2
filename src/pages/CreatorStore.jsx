import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Crown, Award, Music, Radio, ShoppingBag, Sparkles, Loader2, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CollectibleCard from '@/components/collectibles/CollectibleCard';

/**
 * Phase 5 — Creator Storefront.
 * Route: /creator-store/:creatorId
 */
export default function CreatorStore() {
  const { creatorId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('getCreatorStoreData', { creatorId })
      .then(r => setData(r.data?.data || null))
      .finally(() => setLoading(false));
  }, [creatorId]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
      Storefront not available.
    </div>
  );

  const { profile, fanClub, collectibles, sessionBundles, recentLiveDrops, audius, audiusCollectibles } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to={`/artist/${creatorId}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" /> <span className="text-sm font-semibold">Back</span>
        </Link>
        <Badge variant="outline" className="ml-auto">Phase 5 — Storefront</Badge>
      </div>

      {/* Hero */}
      <div className="relative pt-20 pb-10 px-6 bg-gradient-to-br from-indigo-900/40 to-purple-950">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-700 to-indigo-800 flex-shrink-0">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-white text-2xl font-black">
                  {(profile?.display_name || '?')[0].toUpperCase()}
                </div>}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight truncate">
              {profile?.display_name || 'Creator'} Store
            </h1>
            <p className="text-white/60 text-sm mt-1">Fan club, collectibles, drops, and more</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">

        {/* Fan Club */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" /> Fan Club
            </h2>
            <Link to={`/fanclub/${creatorId}`}>
              <Button variant="outline" className="rounded-xl text-xs">View Tiers →</Button>
            </Link>
          </div>
          {fanClub ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-purple-900/40 to-pink-950 border border-purple-500/30 rounded-2xl p-5">
              <p className="text-lg font-black">{fanClub.name}</p>
              {fanClub.description && <p className="text-sm text-white/60 mt-1">{fanClub.description}</p>}
              <div className="flex items-center gap-3 mt-3">
                <Badge className="bg-white/10 text-white border-0">{(fanClub.tiers || []).length} tiers</Badge>
                <Badge className="bg-white/10 text-white border-0">{fanClub.member_count || 0} members</Badge>
              </div>
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground">No fan club yet.</p>
          )}
        </section>

        {/* Collectibles */}
        <section>
          <h2 className="text-xl font-black mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" /> Collectibles
          </h2>
          {collectibles?.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {collectibles.map(c => <CollectibleCard key={c.id} collectible={c} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No collectibles yet.</p>
          )}
        </section>

        {/* Audius collectibles */}
        {audiusCollectibles?.length > 0 && (
          <section>
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" /> Audius Collectibles
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {audiusCollectibles.map((ac, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2">
                  {ac.imageUrl && <img src={ac.imageUrl} alt="" className="aspect-square rounded-lg object-cover" />}
                  <p className="text-xs font-bold truncate">{ac.name || 'Audius Collectible'}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Live Drops history */}
        <section>
          <h2 className="text-xl font-black mb-4 flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-400" /> Live Drops
          </h2>
          {recentLiveDrops?.length ? (
            <div className="space-y-2">
              {recentLiveDrops.map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-purple-700 to-indigo-800 flex-shrink-0 flex items-center justify-center">
                    {d.payload?.media_url
                      ? <img src={d.payload.media_url} alt="" className="w-full h-full object-cover" />
                      : <Award className="w-4 h-4 text-white/60" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{d.payload?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">From: {d.session_title}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(d.timestamp).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No live drops yet.</p>
          )}
        </section>

        {/* Session Bundles */}
        <section>
          <h2 className="text-xl font-black mb-4 flex items-center gap-2">
            <Music className="w-5 h-5 text-purple-400" /> Session Bundles
          </h2>
          {sessionBundles?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sessionBundles.map(b => (
                <div key={b.id} className="p-3 rounded-xl bg-card border border-border">
                  <p className="text-sm font-bold truncate">{b.title}</p>
                  {b.audius_track_id && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-xs mt-1">On Audius</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No published session bundles yet.</p>
          )}
        </section>

        {/* Audius tracks link */}
        {audius?.handle && (
          <section>
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-emerald-400" /> Audius Profile
            </h2>
            <a href={`https://audius.co/${audius.handle}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline">
              @{audius.handle} on Audius →
            </a>
          </section>
        )}

        {/* Merch placeholder */}
        <section>
          <h2 className="text-xl font-black mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-pink-400" /> Merch
          </h2>
          <div className="border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground text-sm">
            Merch storefront coming soon.
          </div>
        </section>
      </div>
    </div>
  );
}