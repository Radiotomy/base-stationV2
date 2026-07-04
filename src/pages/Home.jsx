import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

import {
  Radio, TrendingUp, Music, Star, Zap, ArrowRight,
  Mic2, Headphones, Globe, ChevronRight, Upload, Film, Palette
} from "lucide-react";
import ActivityFeed from "@/components/feed/ActivityFeed";
import CommunityMetrics from "@/components/home/CommunityMetrics";

const MERCURY_BG = "https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/b8218ddcb_generated_image.png";

const STATS = [
  { label: "AI Tracks Created", value: "10K+" },
  { label: "Live Sessions", value: "500+" },
  { label: "Community Artists", value: "2K+" },
  { label: "Countries", value: "80+" },
];

const FEATURES = [
  { to: "/lyrics-studio", icon: Mic2, title: "Lyrics Studio", badge: "New" },
  { to: "/music-studio", icon: Music, title: "Music Studio", badge: "New" },
  { to: "/cover-art-studio", icon: Palette, title: "Cover Art", badge: "New" },
  { to: "/video-studio", icon: Film, title: "Video Studio", badge: "New" },
  { to: "/live-studio", icon: Radio, title: "Live Studio", badge: "Live" },
  { to: "/radio", icon: Radio, title: "Multi-Channel Radio", badge: "Live" },
  { to: "/charts", icon: TrendingUp, title: "Trending Charts", badge: "Hot" },
  { to: "/playlists", icon: Music, title: "Community Playlists", badge: "New" },
  { to: "/featured-artists", icon: Star, title: "Featured Artists", badge: "New" },
  { to: "/voice-creator", icon: Mic2, title: "Voice Creator", badge: "New" },
  { to: "/ai-studio", icon: Zap, title: "AI Tools", badge: "Pro" },
  { to: "/submit", icon: Upload, title: "Submit Your Track", badge: "Pro" },
  { to: "/blockchain", icon: Globe, title: "Multi-Chain Registry", badge: "New" },
  { to: "/templates", icon: Zap, title: "Community Templates", badge: "New" },
  { to: "/audius-trending", icon: Headphones, title: "Audius Network", badge: "Live" },
  { to: "/stem-creator", icon: Music, title: "Stem Creator", badge: "New" },
  { to: "/mashup-studio", icon: Music, title: "Mashup Studio", badge: "Pro" },
  { to: "/vocal-harmonizer", icon: Mic2, title: "Vocal Harmonizer", badge: "Pro" },
  { to: "/mastering-studio", icon: Star, title: "AI Mastering", badge: "Pro" },
  { to: "/visualizer-studio", icon: Film, title: "Visualizer Studio", badge: "Live" },
  { to: "/ai-studio/history", icon: Zap, title: "Studio History", badge: "New" },
];

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
    <div className="min-h-screen relative" style={{ backgroundColor: "#14100C" }}>
      {/* Single static backdrop — `position: fixed` + image keeps GPU layer cached, no per-scroll repaint */}
      <div
        className="fixed inset-0 pointer-events-none will-change-transform"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(20,16,12,0) 0%, rgba(20,16,12,0.5) 70%, rgba(20,16,12,0.85) 100%), url(${MERCURY_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.85,
        }}
      />

      <div className="relative">
        <section className="relative pt-20 pb-20 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] mb-8" style={{ color: "#FBF3E4" }}>
                Where All Creators<br />Own Their Music
              </h1>

              <div className="inline-block rounded-full px-5 py-2 mb-6" style={{ background: "linear-gradient(135deg, #FF9A3D 0%, #FF7A2F 100%)", boxShadow: "0 4px 16px -2px rgba(255,140,60,0.5)" }}>
                <span className="text-[10px] font-bold tracking-[0.25em] text-[#2A1508]">MULTI-CHAIN AI MUSIC ON BASE</span>
              </div>

              <p className="text-white/60 text-sm max-w-xl mx-auto leading-relaxed mb-8">
                Base Station believes human, AI, and hybrid creators equally. Secure blockchain ownership, powerful creation tools, and a community that values your unique voice—however you create.
              </p>

              <div className="flex flex-wrap gap-3 justify-center">
                {user ? (
                  <>
                    <Link to={user?.is_creator === false ? "/radio" : "/creator-dashboard"}>
                      <button className="merc-button rounded-full px-6 py-2.5 font-bold text-sm">
                        {user?.is_creator === false ? "Tune In" : "Go to Studio"}
                      </button>
                    </Link>
                    {user?.is_creator !== false && (
                      <Link to="/music-studio">
                        <button className="merc-button rounded-full px-6 py-2.5 font-bold text-sm">
                          Create Music
                        </button>
                      </Link>
                    )}
                    <Link to="/why-base-station">
                      <button className="merc-button rounded-full px-6 py-2.5 font-bold text-sm">
                        Learn Why
                      </button>
                    </Link>
                  </>
                ) : (
                  <>
                    <button onClick={() => base44.auth.redirectToLogin()} className="merc-button rounded-full px-6 py-2.5 font-semibold text-sm">
                      Join Free
                    </button>
                    <Link to="/radio">
                      <button className="merc-button rounded-full px-6 py-2.5 font-bold text-sm">
                        Explore
                      </button>
                    </Link>
                    <Link to="/why-base-station">
                      <button className="merc-button rounded-full px-6 py-2.5 font-bold text-sm">
                        Learn Why
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <h3 className="font-display text-white text-2xl md:text-3xl mb-6">Base Station by the Numbers</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {STATS.map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-[2rem] h-28 md:h-36 flex flex-col items-center justify-center text-center p-4 -skew-x-6"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,179,71,0.55) 0%, rgba(255,122,47,0.65) 55%, rgba(224,107,46,0.55) 100%)",
                    border: "1px solid rgba(255,200,130,0.6)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 0 40px -6px rgba(255,150,60,0.55)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <div className="skew-x-6">
                    <p className="font-display text-white text-3xl md:text-5xl leading-none drop-shadow-[0_2px_8px_rgba(120,50,0,0.5)]">{value}</p>
                    <p className="text-[10px] md:text-xs text-white/85 mt-1.5 font-bold leading-tight">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-8 px-6">
          <div className="max-w-6xl mx-auto">
            <h3 className="font-display text-white text-2xl md:text-3xl mb-5">Base Station Community</h3>
            <div className="merc-card rounded-3xl p-5">
              <CommunityMetrics />
            </div>
          </div>
        </section>

        <section className="py-12 px-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-display text-white text-3xl md:text-4xl mb-6">Everything Every Creator Needs</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {FEATURES.map(({ to, icon: Icon, title, badge }) => (
                <Link key={title} to={to} className="group block merc-card merc-card-hover rounded-2xl p-3 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <Icon className="w-4 h-4 text-white/70" />
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">{badge}</span>
                  </div>
                  <h3 className="font-semibold text-xs text-white mb-2 leading-tight">{title}</h3>
                  <div className="flex items-center gap-1 text-white/50 text-[10px] font-semibold">
                    Explore <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-display text-white text-3xl md:text-4xl mb-6">Pulse of the Platform</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="merc-card rounded-3xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-xl text-white">Top Tracks</h3>
                  <Link to="/charts" className="merc-button text-xs rounded-full px-3.5 py-1.5 flex items-center gap-1 font-bold">
                    Full Charts <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                {topTracks.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Charts will populate as the community votes!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topTracks.map((track, i) => (
                      <Link to="/charts" key={track.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all">
                        <span className="font-display text-sm text-white/50 w-5">{i + 1}</span>
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                          {track.cover_image_url ? <img src={track.cover_image_url} alt={track.track_title} className="w-full h-full object-cover" /> : <Music className="w-4 h-4 m-2.5 text-white/40" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate text-white">{track.track_title}</p>
                          <p className="text-xs text-white/50 truncate">{track.artist_name}</p>
                          <div className="h-1 mt-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(8, Math.round(((track.total_votes || 0) / Math.max(1, topTracks[0]?.total_votes || 1)) * 100))}%`,
                                background: "linear-gradient(90deg, #FFB347 0%, #FF6B4A 100%)",
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-white/60 flex-shrink-0">{track.total_votes?.toLocaleString() || 0}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="merc-card rounded-3xl p-5">
                <h3 className="font-display text-xl text-white mb-4">Community Buzz</h3>
                <ActivityFeed limit={8} />
              </div>
            </div>
          </div>
        </section>

        {featuredPlaylists.length > 0 && (
          <section className="py-12 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-white text-2xl md:text-3xl">Featured Collections</h2>
                <Link to="/playlists" className="merc-button text-xs rounded-full px-3.5 py-1.5 flex items-center gap-1 font-bold">
                  All Playlists <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {featuredPlaylists.slice(0, 3).map((pl) => (
                  <Link
                    key={pl.id}
                    to={`/playlists/${pl.id}`}
                    className="flex items-center gap-3 rounded-2xl p-3 transition-all group hover:brightness-110"
                    style={{
                      background: "linear-gradient(135deg, #FFB347 0%, #FF8A3D 55%, #FF6B4A 100%)",
                      boxShadow: "0 6px 24px -6px rgba(255,140,60,0.5)",
                    }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-black/30 overflow-hidden flex-shrink-0">
                      {pl.cover_image_url && <img src={pl.cover_image_url} alt={pl.title} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate text-[#2A1508]">{pl.title}</p>
                      <p className="text-[11px] text-[#2A1508]/70 font-semibold">{pl.track_count || 0} tracks</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#2A1508]/60 group-hover:text-[#2A1508]" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {featuredArtists.length > 0 && (
          <section className="py-12 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-white text-2xl md:text-3xl">Featured Artists</h2>
                <Link to="/featured-artists" className="text-xs text-white/60 hover:text-white flex items-center gap-1 font-semibold">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {featuredArtists.map((a) => (
                  <div key={a.id} className="group relative aspect-square rounded-2xl overflow-hidden merc-card cursor-pointer">
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
          </section>
        )}

        <section className="py-20 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-5xl md:text-7xl mb-6">
              <span className="text-iridescent">Human + AI</span>
            </h2>
            <p className="text-white/60 text-sm md:text-base mb-8 leading-relaxed max-w-xl mx-auto">
              Base Station believes AI is a co-creator. Your creativity drives the music — AI amplifies it. Every track, every vote, every transaction is on-chain and forever.
            </p>
            {user ? (
              <Link to="/radio">
                <button className="merc-button rounded-full px-10 py-3 font-bold text-sm">
                  Go to Radio
                </button>
              </Link>
            ) : (
              <button onClick={() => base44.auth.redirectToLogin()} className="merc-button rounded-full px-10 py-3 font-semibold text-sm">
                Join Base Station
              </button>
            )}
          </div>
        </section>

        <footer className="border-t border-white/10 py-8 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/50">
            <div className="font-display text-base" style={{ color: "#FF7A2F" }}>BaseStation</div>
            <p>BaseStation — Multi-Chain AI Music</p>
            <p>© 2026 BaseStation. Multi-Chain, Always.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}