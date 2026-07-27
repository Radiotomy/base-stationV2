import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Users, Crown, Award, Heart } from "lucide-react";
import FollowedArtistsSection from "@/components/fan/FollowedArtistsSection";
import FollowingFeed from "@/components/fan/FollowingFeed";
import MyMembershipsSection from "@/components/fan/MyMembershipsSection";
import MyCollectiblesSection from "@/components/fan/MyCollectiblesSection";
import MyCreatorActions from "@/components/fan/MyCreatorActions";

export default function FanHub() {
  const { user } = useAuth();
  const [follows, setFollows] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [claims, setClaims] = useState([]);
  const [tips, setTips] = useState([]);
  const [creatorMap, setCreatorMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Sequenced to stay under the per-second rate limit; each guarded
      const f = await base44.entities.Follow.filter({ follower_id: user.id }, "-created_date", 100).catch(() => []);
      const m = await base44.entities.FanClubMembership.filter({ user_id: user.id, status: "active" }, "-created_date", 50).catch(() => []);
      const c = await base44.entities.CollectibleClaim.filter({ user_id: user.id }, "-created_date", 100).catch(() => []);
      const t = await base44.entities.Tip.filter({ from_user_id: user.id }, "-created_date", 100).catch(() => []);
      setFollows(f); setMemberships(m); setClaims(c); setTips(t);

      // Build creator id → display name map from what we already have
      const map = {};
      f.forEach(r => { if (r.following_id && r.following_name) map[r.following_id] = r.following_name; });
      t.forEach(r => { if (r.to_artist_id && r.to_artist_name) map[r.to_artist_id] = r.to_artist_name; });
      // Resolve any creators still unnamed (memberships/claims) via artist profiles
      const unnamed = [...new Set([...m.map(r => r.creator_id), ...c.map(r => r.creator_id)])]
        .filter(id => id && !map[id]);
      if (unnamed.length > 0) {
        const profiles = await base44.entities.ArtistProfile
          .filter({ user_id: { $in: unnamed } }, "-created_date", 100)
          .catch(() => []);
        profiles.forEach(p => { map[p.user_id] = p.display_name; });
      }
      setCreatorMap(map);
      setLoading(false);
    };
    load();
  }, [user]);

  if (!user || loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
    </div>
  );

  const tipsTotalCents = tips.filter(t => t.status === "completed" || t.status === "pending")
    .reduce((s, t) => s + (t.amount_cents || 0), 0);

  const STATS = [
    { icon: Users, label: "Following", value: follows.length, accent: "#FF9A4D" },
    { icon: Crown, label: "Fan Clubs", value: memberships.length, accent: "#fbbf24" },
    { icon: Award, label: "Collectibles", value: claims.length, accent: "#60a5fa" },
    { icon: Heart, label: "Tips Sent", value: `$${(tipsTotalCents / 100).toFixed(2)}`, accent: "#fb7185" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-12">
      {/* Hero */}
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#FF9A4D] mb-1.5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF9A4D] animate-pulse" style={{ boxShadow: "0 0 8px #FF9A4D" }} />
          fan // hub
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">My Fan Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">Artists you follow · memberships · collectibles · your support history</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {STATS.map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}20` }}>
              <Icon className="w-4 h-4" style={{ color: accent }} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-black text-foreground leading-tight">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <FollowingFeed follows={follows} />
          <FollowedArtistsSection follows={follows} />
          <MyMembershipsSection memberships={memberships} creatorMap={creatorMap} />
          <MyCollectiblesSection claims={claims} creatorMap={creatorMap} />
        </div>
        <div>
          <MyCreatorActions userId={user.id} creatorMap={creatorMap} />
        </div>
      </div>
    </div>
  );
}