import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import {
  Radio, TrendingUp, Music, Star, Users, Zap, Play, ArrowRight,
  Mic2, Headphones, Globe, ChevronRight, Upload, Film, Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ActivityFeed from "@/components/feed/ActivityFeed";
import CommunityMetrics from "@/components/home/CommunityMetrics";

const HOLO_BG = "https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/6aabc89fb_generated_image.png";
const CHROME_BLOB = "https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/a34586198_generated_image.png";

const STATS = [
  { label: "AI Tracks Created", value: "10K+", icon: Music },
  { label: "Live Sessions", value: "500+", icon: Mic2 },
  { label: "Community Artists", value: "2K+", icon: Users },
  { label: "Countries", value: "80+", icon: Globe },
];

export default function Home() {
  const [topTracks, setTopTracks] = useState([]);
  const [featuredArtists, setFeaturedArtists] = useState([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.TrackChart.filter({ period: "weekly" }, "-total_votes", 5).then(setTopTracks).catch(() => {});
    base44.entities.FeaturedArtistApplication.filter({ status: "approved" }, "-featured_since", 6).then(setFeaturedArtists).catch(() => {});
    base44.entities.Playlist.filter({ is_featured: true }, "-created_date", 6).then(setFeaturedPlaylists).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen relative" style={{ backgroundImage: `url(${HOLO_BG})`, backgroundSize: "cover", backgroundAttachment: "fixed" }}>
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px]" />

      <div className="relative">
        {/* Hero */}
        <section className="relative pt-20 pb-16 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <div className="inline-block holo-chrome rounded-full px-5 py-2 mb-8">
                  <span className="text-xs font-bold tracking-[0.2em] text-foreground">MULTI-CHAIN AI MUSIC ON BASE</span>
                </div>
                <h1 className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-9xl text-foreground mb-8 leading-[0.95]">
                  Where All Creators<br />Own Their Music
                </h1>
              </motion.div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="holo-card rounded-2xl p-5 mb-6 border border-white/60">
                  <p className="text-foreground/80 text-sm leading-relaxed">
                    Base Station believes human, AI, and hybrid creators equally. Secure blockchain ownership, powerful creation tools, and a community that values your unique voice—however you create.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 mb-6">
                  {user ? (
                    <>
                      <Link to={user?.is_creator === false ? "/radio" : "/creator-dashboard"}>
                        <button className="holo-button rounded-full px-6 py-2.5 font-bold text-sm text-foreground border border-white/70">
                          {user?.is_creator === false ? "Tune In 📻" : "Go to Studio 🎵"}
                        </button>
                      </Link>
                      {user?.is_creator !== false && (
                        <Link to="/music-studio">
                          <button className="holo-button rounded-full px-6 py-2.5 font-bold text-sm text-foreground border border-white/70">
                            🎵 Create Music
                          </button>
                        </Link>
                      )}
                      <Link to="/why-base-station">
                        <button className="holo-button rounded-full px-6 py-2.5 font-bold text-sm text-foreground border border-white/70">
                          Learn Why ↗
                        </button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <button onClick={() => base44.auth.redirectToLogin()} className="holo-button rounded-full px-6 py-2.5 font-bold text-sm text-foreground border border-white/70">
                        Join Free
                      </button>
                      <Link to="/radio">
                        <button className="holo-button rounded-full px-6 py-2.5 font-bold text-sm text-foreground border border-white/70">
                          🎧 Explore
                        </button>
                      </Link>
                      <Link to="/why-base-station">
                        <button className="holo-button rounded-full px-6 py-2.5 font-bold text-sm text-foreground border border-white/70">
                          Why Join ↗
                        </button>
                      </Link>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "🔴 Live Session", sub: "Hip-Hop Showcase" },
                    { label: "🔥 #1 Chart", sub: "This Week's Top Track" },
                    { label: "⭐ Featured", sub: "New Artist Spotlight" },
                  ].map(({ label, sub }) => (
                    <div key={label} className="holo-card rounded-2xl px-4 py-2 border border-white/60">
                      <p className="font-bold text-xs text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden md:flex justify-center items-center relative">
                <div className="absolute inset-0 holo-foil rounded-full blur-3xl opacity-50" />
                <img src={CHROME_BLOB} alt="" className="relative w-full max-w-md drop-shadow-2xl" style={{ mixBlendMode: "multiply" }} />
              </div>
            </div>
          </div>
        </section>

        {/* Stats with chrome bubbles */}
        <section className="py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h3 className="font-display text-3xl md:text-4xl text-foreground mb-2">Base Station by the Numbers</h3>
              <p className="text-muted-foreground text-sm">Powered by creators of all kinds</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map(({ label, value, icon: Icon }) => (
                <div key={label} className="holo-chrome rounded-full aspect-square flex flex-col items-center justify-center border border-white/70 p-4 text-center">
                  <Icon className="w-5 h-5 mb-1.5 text-foreground/60" />
                  <p className="font-display text-2xl md:text-3xl text-foreground leading-none">{value}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Community Metrics */}
        <section className="py-12 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="holo-card rounded-3xl p-6 border border-white/60">
              <CommunityMetrics />
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-4xl md:text-5xl text-foreground mb-3">Everything Every Creator Needs</h2>
              <p className="text-muted-foreground text-base max-w-2xl mx-auto">Whether you compose, collaborate with AI, or blend both—Base Station provides the tools, community, and on-chain ownership to support your unique creative vision.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { to: "/lyrics-studio", icon: Mic2, title: "Lyrics Studio", emoji: "🎤", desc: "Generate original lyrics with Nuro AI. Real-time refinement. Unlimited versions.", badge: "✨ New" },
                { to: "/music-studio", icon: Music, title: "Music Studio", emoji: "🎵", desc: "Create AI tracks with Loudly, Nuro, Sonic, or Producer. Full BPM & key metadata.", badge: "✨ New" },
                { to: "/cover-art-studio", icon: Palette, title: "Cover Art", emoji: "🎨", desc: "Generate professional album artwork. Cheap auto-generated or custom high-quality designs.", badge: "✨ New" },
                { to: "/video-studio", icon: Film, title: "Video Studio", emoji: "🎬", desc: "Generate cinematic videos with LTX AI. Perfect for music visualizers and promos.", badge: "✨ New" },
                { to: "/live-studio", icon: Radio, title: "Live Studio", emoji: "🔴", desc: "Stream live sessions with multi-track mixing. Record for later. Interactive viewer chat.", badge: "✨ New" },
                { to: "/radio", icon: Radio, title: "Multi-Channel Radio", emoji: "📻", desc: "6+ genre channels streaming 24/7. Tune into Discover, Hip-Hop, EDM, Lo-Fi and more.", badge: "Live" },
                { to: "/charts", icon: TrendingUp, title: "Trending Charts", emoji: "📊", desc: "Real-time weekly, monthly, and all-time rankings powered by community votes — zero algorithms.", badge: "🔥 Hot" },
                { to: "/playlists", icon: Music, title: "Community Playlists", emoji: "📝", desc: "Curate and discover playlists from the world's most creative AI music artists.", badge: "Browse" },
                { to: "/featured-artists", icon: Star, title: "Featured Artists", emoji: "⭐", desc: "Apply to the spotlight program and get your music in front of thousands of new listeners.", badge: "Apply" },
                { to: "/voice-creator", icon: Mic2, title: "Voice Creator", emoji: "🎤", desc: "Create and manage AI voice personas. Build your voice library and use them across tracks.", badge: "✨ New" },
                { to: "/ai-studio", icon: Zap, title: "AI Tools", emoji: "⚡", desc: "Advanced prompts, voice synthesis, cover generation and more creative tools.", badge: "Pro" },
                { to: "/submit", icon: Upload, title: "Submit Your Track", emoji: "📤", desc: "Share your AI music with the community. Get on charts, enter challenges, build your fanbase.", badge: "Go Live" },
                { to: "/blockchain", icon: Globe, title: "Multi-Chain Registry", emoji: "⛓️", desc: "Register your tracks on Base (primary) or Solana with immutable authorship proof and verification.", badge: "Mint NFT" },
                { to: "/templates", icon: Zap, title: "Community Templates", emoji: "🎨", desc: "Discover and share AI prompts for Music, Lyrics, Cover Art & Video. One-click copy & use.", badge: "New" },
                { to: "/audius-trending", icon: Headphones, title: "Audius Network", emoji: "🎧", desc: "Discover trending tracks across the OpenAudio Protocol. Import, remix & publish your own.", badge: "Phase 2" },
                { to: "/stem-creator", icon: Music, title: "Stem Creator", emoji: "🎛️", desc: "Split any track into vocals, drums, bass, and instruments. Provider-agnostic AI.", badge: "Phase 3" },
                { to: "/mashup-studio", icon: Music, title: "Mashup Studio", emoji: "🔀", desc: "Blend 2–4 tracks into one. Auto-detects BPM, key, and aligns them perfectly.", badge: "Phase 3" },
                { to: "/vocal-harmonizer", icon: Mic2, title: "Vocal Harmonizer", emoji: "🎤", desc: "Add lush AI-generated harmonies — 3rds, 5ths, octaves — to any vocal track.", badge: "Phase 3" },
                { to: "/mastering-studio", icon: Star, title: "AI Mastering", emoji: "✨", desc: "Pro-grade mastering profiles: streaming, club, vinyl, warm. LUFS-targeted output.", badge: "Phase 3" },
                { to: "/visualizer-studio", icon: Film, title: "Visualizer Studio", emoji: "🎬", desc: "Generate animated music videos and visualizers from any track.", badge: "Phase 3" },
                { to: "/ai-studio/history", icon: Zap, title: "Studio History", emoji: "🕒", desc: "Complete log of every studio action you've taken — reopen any tool with one click.", badge: "Phase 3" },
              ].map(({ to, icon: Icon, title, emoji, desc, badge }) => (
                <Link key={title} to={to} className="group block holo-card rounded-2xl p-5 border border-white/60 hover:border-white/90 hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{emoji}</span>
                      <Icon className="w-5 h-5 text-foreground/70" />
                    </div>
                    <Badge className="bg-white/70 text-foreground/70 border border-white/80 text-[10px] font-semibold">{badge}</Badge>
                  </div>
                  <h3 className="font-display text-base text-foreground mb-1.5">{title}</h3>
                  <p className="text-foreground/60 text-xs leading-relaxed mb-3">{desc}</p>
                  <div className="flex items-center gap-1 text-foreground text-xs font-bold">
                    Explore <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Top Tracks + Activity */}
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-4xl md:text-5xl text-foreground">Pulse of the Platform</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-2xl text-foreground">🔥 Top Tracks</h3>
                  <Link to="/charts" className="text-sm text-foreground/70 hover:text-foreground flex items-center gap-1 font-bold">
                    Full Charts <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                {topTracks.length === 0 ? (
                  <div className="holo-card text-center py-12 text-muted-foreground rounded-2xl border border-white/60">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Charts will populate as the community votes!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topTracks.map((track, i) => (
                      <Link to="/charts" key={track.id} className="flex items-center gap-3 p-3 holo-card rounded-2xl border border-white/60 hover:border-white/90 transition-all">
                        <div className="holo-chrome w-9 h-9 rounded-full flex items-center justify-center border border-white/70 flex-shrink-0">
                          <span className="font-display text-sm text-foreground">{i + 1}</span>
                        </div>
                        <div className="w-11 h-11 rounded-xl overflow-hidden holo-chrome border border-white/70 flex-shrink-0">
                          {track.cover_image_url ? <img src={track.cover_image_url} alt={track.track_title} className="w-full h-full object-cover" /> : <Music className="w-4 h-4 m-3.5 text-foreground/40" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate text-foreground">{track.track_title}</p>
                          <p className="text-xs text-muted-foreground truncate">{track.artist_name}</p>
                        </div>
                        <span className="text-xs font-bold text-foreground/70 flex-shrink-0">{track.total_votes?.toLocaleString() || 0}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-2xl text-foreground">⚡ Community Buzz</h3>
                </div>
                <div className="holo-card rounded-2xl p-4 border border-white/60">
                  <ActivityFeed limit={8} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Collections */}
        {featuredPlaylists.length > 0 && (
          <section className="py-16 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-display text-3xl md:text-4xl text-foreground">⭐ Featured Collections</h2>
                <Link to="/playlists" className="text-sm text-foreground/70 hover:text-foreground flex items-center gap-1 font-bold">
                  All Playlists <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {featuredPlaylists.map((pl) => (
                  <Link key={pl.id} to={`/playlists/${pl.id}`} className="flex items-center gap-4 holo-card rounded-full p-2 pr-6 border border-white/60 hover:border-white/90 transition-all group">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 overflow-hidden flex-shrink-0 border border-white/70">
                      {pl.cover_image_url && <img src={pl.cover_image_url} alt={pl.title} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-base truncate text-foreground">{pl.title}</p>
                      <p className="text-xs text-muted-foreground">{pl.track_count || 0} tracks</p>
                    </div>
                    <Play className="w-5 h-5 text-foreground/60 group-hover:text-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured Artists */}
        {featuredArtists.length > 0 && (
          <section className="py-16 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-display text-3xl md:text-4xl text-foreground">🎤 Featured Artists</h2>
                <Link to="/featured-artists" className="text-sm text-foreground/70 hover:text-foreground flex items-center gap-1 font-bold">
                  View All <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {featuredArtists.map((a) => (
                  <div key={a.id} className="group relative aspect-square rounded-3xl overflow-hidden holo-chrome border border-white/70 cursor-pointer">
                    {a.profile_image_url && <img src={a.profile_image_url} alt={a.artist_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white font-bold text-xs">{a.artist_name}</p>
                      <p className="text-white/70 text-[10px] capitalize">{a.genre}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-24 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-5xl md:text-7xl text-foreground mb-6">
              Human + AI<br /><span className="text-holo">on Chain</span>
            </h2>
            <p className="text-foreground/70 text-base md:text-lg mb-10 leading-relaxed max-w-xl mx-auto">
              Base Station believes AI is a co-creator. Your creativity drives the music — AI amplifies it. Every track, every vote, every transaction is on-chain and forever.
            </p>
            {user ? (
              <Link to="/radio">
                <button className="holo-button rounded-full px-10 py-3.5 font-display text-base text-foreground border border-white/70">
                  Go to Radio →
                </button>
              </Link>
            ) : (
              <button onClick={() => base44.auth.redirectToLogin()} className="holo-button rounded-full px-10 py-3.5 font-display text-base text-foreground border border-white/70">
                Join Base Station →
              </button>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/40 py-10 px-6 holo-card">
          <div className="max-w-7xl mx-auto text-center">
            <div className="font-display text-lg mb-2 text-foreground">
              BaseStation <span className="text-muted-foreground font-normal text-sm font-body">— Multi-Chain AI Music</span>
            </div>
            <p className="text-xs text-muted-foreground">© 2026 BaseStation. Multi-Chain, Always.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}