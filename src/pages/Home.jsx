import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Radio, TrendingUp, Music, Star, Users, Zap, Play, ArrowRight,
  Mic2, Headphones, Globe, ChevronRight, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ActivityFeed from "@/components/feed/ActivityFeed";

const NAV_LINKS = [
  { to: "/radio", label: "Radio", icon: Radio },
  { to: "/charts", label: "Charts", icon: TrendingUp },
  { to: "/playlists", label: "Playlists", icon: Music },
  { to: "/challenges", label: "Challenges", icon: Zap },
  { to: "/leaderboard", label: "Leaderboard", icon: Star },
  { to: "/ai-studio", label: "AI Studio", icon: Headphones },
  { to: "/solana", label: "Solana", icon: Globe },
];

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
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-black text-xl tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">AI</span>
            <span className="text-foreground">VTV</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                <Icon className="w-4 h-4" />{label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {user?.role === "admin" && (
              <Link to="/admin">
                <Button variant="outline" className="rounded-full border-purple-500/40 text-purple-400 hover:bg-purple-500/10 font-semibold px-4 hidden md:flex text-xs">
                  Admin
                </Button>
              </Link>
            )}
            {user && (
              <Link to="/submit">
                <Button variant="outline" className="rounded-full border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-semibold px-4 hidden md:flex">
                  <Upload className="w-4 h-4 mr-1.5" /> Submit
                </Button>
              </Link>
            )}
            {user ? (
              <Link to="/radio">
                <Button className="rounded-full bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5">
                  <Radio className="w-4 h-4 mr-2" /> Tune In
                </Button>
              </Link>
            ) : (
              <Button onClick={() => base44.auth.redirectToLogin()} className="rounded-full bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5">
                Get Started
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6 pt-16">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-black to-indigo-950" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-600/20 blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-pink-600/15 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-3xl" />
        </div>
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative text-center max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <Badge className="mb-8 bg-purple-500/20 text-purple-300 border-purple-500/30 px-5 py-2 text-xs tracking-widest uppercase font-semibold">
              🎵 The Future of AI Music is Live
            </Badge>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black text-white mb-6 tracking-tight leading-none">
              Where AI
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">
                Music Lives
              </span>
            </h1>
            <p className="text-white/60 text-xl md:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed">
              Create, discover, and share AI-generated music with a global community of artists and fans. Live sessions, trending charts, and blockchain-verified tracks.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => user ? null : base44.auth.redirectToLogin()}
                className="bg-white text-purple-900 hover:bg-purple-50 font-bold px-10 py-4 rounded-full text-lg shadow-xl shadow-purple-900/30">
                {user ? "Welcome Back 🎵" : "Join Free"}
              </Button>
              <Link to="/radio">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 font-bold px-10 py-4 rounded-full text-lg backdrop-blur">
                  <Headphones className="w-5 h-5 mr-2" /> Tune Into Radio
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Floating cards */}
          <motion.div className="mt-16 relative h-32" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            {[
              { label: "🔴 Live Session", sub: "Hip-Hop Showcase", pos: "left-0" },
              { label: "🔥 #1 Chart", sub: "This Week's Top Track", pos: "left-1/2 -translate-x-1/2" },
              { label: "⭐ Featured", sub: "New Artist Spotlight", pos: "right-0" },
            ].map(({ label, sub, pos }) => (
              <div key={label} className={`absolute top-0 ${pos} bg-white/10 backdrop-blur border border-white/10 rounded-2xl px-5 py-3 hidden sm:block`}>
                <p className="text-white font-bold text-sm">{label}</p>
                <p className="text-white/50 text-xs mt-0.5">{sub}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-border/50 bg-muted/20">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ label, value, icon: Icon }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
              <Icon className="w-6 h-6 mx-auto mb-3 text-purple-400" />
              <p className="text-3xl font-black text-foreground">{value}</p>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature Hubs */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-foreground mb-4">Everything a Creator Needs</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">From live sessions to trending charts — AIVTV is the complete platform for AI music creators.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { to: "/radio", icon: Radio, title: "Multi-Channel Radio", desc: "6+ genre channels streaming 24/7. Tune into Discover, Hip-Hop, EDM, Lo-Fi and more.", color: "from-purple-900 to-violet-900", accent: "text-purple-400", badge: "Live" },
              { to: "/charts", icon: TrendingUp, title: "Trending Charts", desc: "Real-time weekly, monthly, and all-time rankings powered by community votes — zero algorithms.", color: "from-orange-900 to-red-900", accent: "text-orange-400", badge: "🔥 Hot" },
              { to: "/playlists", icon: Music, title: "Community Playlists", desc: "Curate and discover playlists from the world's most creative AI music artists.", color: "from-indigo-900 to-blue-900", accent: "text-indigo-400", badge: "New" },
              { to: "/featured-artists", icon: Star, title: "Featured Artists", desc: "Apply to the spotlight program and get your music in front of thousands of new listeners.", color: "from-yellow-900 to-amber-900", accent: "text-yellow-400", badge: "Apply" },
              { to: "/ai-studio", icon: Zap, title: "AI Tools Studio", desc: "Generate lyrics, music prompts & cover art with AI. Everything you need to create your next hit.", color: "from-pink-900 to-rose-900", accent: "text-pink-400", badge: "New ✨" },
              { to: "/submit", icon: Upload, title: "Submit Your Track", desc: "Share your AI music with the AIVTV community. Get on charts, enter challenges, build your fanbase.", color: "from-emerald-900 to-teal-900", accent: "text-emerald-400", badge: "Open Now" },
              { to: "/solana", icon: Globe, title: "Solana Provenance", desc: "Register your tracks on-chain with immutable authorship proof and blockchain verification on Solana.", color: "from-violet-900 to-slate-900", accent: "text-violet-400", badge: "⛓️ Phase 4" },
            ].map(({ to, icon: Icon, title, desc, color, accent, badge }, i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <Link to={to} className={`group block p-6 rounded-3xl bg-gradient-to-br ${color} border border-white/5 hover:border-white/10 transition-all hover:scale-[1.02]`}>
                  <div className="flex items-start justify-between mb-4">
                    <Icon className={`w-8 h-8 ${accent}`} />
                    <Badge className="bg-white/10 text-white/70 border-0 text-xs">{badge}</Badge>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
                  <div className={`flex items-center gap-1 mt-4 ${accent} text-sm font-semibold group-hover:gap-2 transition-all`}>
                    Explore <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Tracks + Activity Feed */}
      <section className="py-16 px-6 bg-muted/20 border-y border-border/50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Top Tracks */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-foreground">🔥 Top Tracks This Week</h2>
              <Link to="/charts" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold">
                Full Charts <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {topTracks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Charts will populate as the community votes!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topTracks.map((track, i) => (
                  <Link to="/charts" key={track.id} className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group">
                    <span className={`w-8 text-center text-xl font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>{i + 1}</span>
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-purple-800 to-indigo-900 flex-shrink-0">
                      {track.cover_image_url ? <img src={track.cover_image_url} alt={track.track_title} className="w-full h-full object-cover" /> : <Music className="w-5 h-5 m-3.5 text-white/30" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate text-foreground">{track.track_title}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.artist_name}</p>
                    </div>
                    <span className="text-sm font-bold text-orange-400 flex-shrink-0">{track.total_votes?.toLocaleString() || 0} votes</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-foreground">⚡ Community Buzz</h2>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <ActivityFeed limit={8} />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Collections */}
      {featuredPlaylists.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-foreground">⭐ Featured Collections</h2>
              <Link to="/playlists" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold">
                All Playlists <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {featuredPlaylists.map((pl, i) => (
                <Link key={pl.id} to={`/playlists/${pl.id}`} className="group">
                  <div className="aspect-square rounded-2xl bg-gradient-to-br from-purple-800 to-indigo-900 overflow-hidden mb-3 relative">
                    {pl.cover_image_url && <img src={pl.cover_image_url} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-8 h-8 text-white" fill="white" />
                    </div>
                  </div>
                  <p className="font-bold text-xs truncate text-foreground group-hover:text-purple-400 transition-colors">{pl.title}</p>
                  <p className="text-xs text-muted-foreground">{pl.track_count || 0} tracks</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Artists */}
      {featuredArtists.length > 0 && (
        <section className="py-16 px-6 bg-muted/20 border-t border-border/50">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-foreground">🎤 Featured Artists</h2>
              <Link to="/featured-artists" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {featuredArtists.map((a) => (
                <div key={a.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-yellow-900 to-orange-900 cursor-pointer">
                  {a.profile_image_url && <img src={a.profile_image_url} alt={a.artist_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white font-bold text-xs">{a.artist_name}</p>
                    <p className="text-white/50 text-xs capitalize">{a.genre}</p>
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
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl md:text-6xl font-black text-foreground mb-6">
              Human + AI<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">as Equals</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
              AIVTV believes AI is a co-creator, not a replacement. Your creativity drives the music — AI amplifies it. Every track you make, every vote you cast, every session you host shapes this community.
            </p>
            <Button onClick={() => user ? null : base44.auth.redirectToLogin()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-12 py-4 rounded-full text-lg shadow-xl shadow-purple-900/40">
              {user ? "Go to Radio →" : "Join the Movement"}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-black text-lg">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">AI</span>
            <span className="text-foreground">VTV</span>
            <span className="text-muted-foreground font-normal text-sm ml-2">— AI Music for Everyone</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            {NAV_LINKS.map(({ to, label }) => <Link key={to} to={to} className="hover:text-foreground transition-colors">{label}</Link>)}
          </div>
          <p className="text-xs text-muted-foreground">© 2026 AIVTV. Human + AI, always.</p>
        </div>
      </footer>
    </div>
  );
}