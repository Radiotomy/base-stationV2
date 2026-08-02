import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { ChevronRight } from "lucide-react";

import CommunityMetrics from "@/components/home/CommunityMetrics";
import HomeRackHero from "@/components/home/HomeRackHero";
import HomeStatsStrip from "@/components/home/HomeStatsStrip";
import HomeFeatureGrid from "@/components/home/HomeFeatureGrid";
import HomePulsePanels from "@/components/home/HomePulsePanels";
import HomeTemplatesPreview from "@/components/home/HomeTemplatesPreview";
import HomeTrustStrip from "@/components/home/HomeTrustStrip";

const MERCURY_BG = "https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/b8218ddcb_generated_image.png";

function RailHoles() {
  return (
    <div className="hidden sm:flex flex-col justify-between items-center w-7 self-stretch py-10 flex-shrink-0">
      {[...Array(10)].map((_, i) => (
        <span key={i} className="w-2.5 h-4 rounded-full bg-[#050403] shadow-[inset_0_1px_2px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)]" />
      ))}
    </div>
  );
}

export default function Home() {
  const [topTracks, setTopTracks] = useState([]);
  const [featuredArtists, setFeaturedArtists] = useState([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  // Reuse the auth context user — no duplicate auth.me() roundtrip
  const { user } = useAuth();

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      base44.entities.TrackChart.filter({ period: "weekly" }, "-total_votes", 5),
      base44.entities.FeaturedArtistApplication.filter({ status: "approved" }, "-featured_since", 6),
      base44.entities.Playlist.filter({ is_featured: true }, "-created_date", 6),
    ]).then(([t, a, p]) => {
      if (!alive) return;
      if (t.status === 'fulfilled') setTopTracks(t.value || []);
      if (a.status === 'fulfilled') setFeaturedArtists(a.value || []);
      if (p.status === 'fulfilled') setFeaturedPlaylists(p.value || []);
    });
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen pt-16 pb-10 px-2 sm:px-4" style={{ backgroundColor: "#0A0806" }}>
      {/* Outer rack chassis */}
      <div className="max-w-6xl mx-auto rounded-xl border-2 border-black bg-gradient-to-b from-[#1A1512] via-[#131009] to-[#0E0B08] shadow-[0_20px_60px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex">
          <RailHoles />
          <div className="flex-1 min-w-0 px-2 sm:px-3 py-4 space-y-4">

            <HomeRackHero user={user} />

            <HomeStatsStrip />

            <CommunityMetrics />

            <HomeFeatureGrid />

            <HomeTemplatesPreview />

            <HomePulsePanels topTracks={topTracks} />

            {featuredPlaylists.length > 0 && (
              <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#1C1712] to-[#0F0C09] p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-white text-xl md:text-2xl">Featured Collections</h2>
                  <Link
                    to="/playlists"
                    className="text-[10px] font-black rounded-full px-3.5 py-1.5 flex items-center gap-1 text-[#2A1508]"
                    style={{
                      background: "linear-gradient(135deg, #FFB347 0%, #FF7A2F 100%)",
                      boxShadow: "0 3px 10px -2px rgba(120,60,10,0.5)",
                    }}
                  >
                    All Playlists <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {featuredPlaylists.slice(0, 3).map((pl) => (
                    <Link
                      key={pl.id}
                      to={`/playlists/${pl.id}`}
                      className="relative flex items-center gap-3 rounded-lg border border-black/70 p-3 overflow-hidden transition-all group hover:brightness-110"
                      style={{
                        backgroundImage: `linear-gradient(rgba(30,15,5,0.35), rgba(30,15,5,0.5)), url(${MERCURY_BG})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        boxShadow: "0 6px 20px -6px rgba(255,140,60,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                      }}
                    >
                      <div className="w-12 h-12 rounded-lg bg-black/40 overflow-hidden flex-shrink-0 border border-black/50">
                        {pl.cover_image_url && <img src={pl.cover_image_url} alt={pl.title} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate text-white drop-shadow">{pl.title}</p>
                        <p className="text-[11px] text-white/80 font-semibold">{pl.track_count || 0} Tracks</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/70 group-hover:text-white" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {featuredArtists.length > 0 && (
              <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#1C1712] to-[#0F0C09] p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-white text-xl md:text-2xl">Featured Artists</h2>
                  <Link to="/featured-artists" className="text-xs text-white/60 hover:text-white flex items-center gap-1 font-semibold">
                    View All <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {featuredArtists.map((a) => (
                    <div key={a.id} className="group relative aspect-square rounded-lg overflow-hidden border border-black/70 bg-[#171310] cursor-pointer">
                      {a.profile_image_url && <img src={a.profile_image_url} alt={a.artist_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white font-bold text-xs">{a.artist_name}</p>
                        <p className="text-white/60 text-[10px] capitalize">{a.genre}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <HomeTrustStrip />

          </div>
          <RailHoles />
        </div>
      </div>
    </div>
  );
}