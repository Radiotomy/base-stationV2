import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Radio as RadioIcon, Users, ChevronRight, Wifi, Headphones } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

const DEFAULT_CHANNELS = [
  { id: "discover", name: "Discover", slug: "discover", genre: "discover", emoji: "🌟", color_theme: "#7C3AED", description: "Fresh AI music from the community", listener_count: 0, is_active: true },
  { id: "staff-picks", name: "Staff Picks", slug: "staff-picks", genre: "staff-picks", emoji: "⭐", color_theme: "#F59E0B", description: "Curated by the Base Station team", listener_count: 0, is_active: true },
  { id: "hip-hop", name: "Hip-Hop & Trap", slug: "hip-hop", genre: "hip-hop", emoji: "🎤", color_theme: "#EF4444", description: "AI beats, bars & trap bangers", listener_count: 0, is_active: true },
  { id: "edm", name: "EDM & Electronic", slug: "edm", genre: "edm", emoji: "⚡", color_theme: "#06B6D4", description: "Synths, drops & AI energy", listener_count: 0, is_active: true },
  { id: "rb-soul", name: "R&B / Soul", slug: "rb-soul", genre: "r&b", emoji: "🎵", color_theme: "#EC4899", description: "Smooth AI R&B and neo-soul", listener_count: 0, is_active: true },
  { id: "lofi", name: "Lo-Fi Chill", slug: "lofi", genre: "lo-fi", emoji: "☕", color_theme: "#84CC16", description: "Chill beats to create and relax", listener_count: 0, is_active: true },
];

export default function Radio() {
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [activeChannel, setActiveChannel] = useState(DEFAULT_CHANNELS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [muted, setMuted] = useState(false);
  const [nowPlaying, setNowPlaying] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    // Load custom channels from DB, fallback to defaults
    base44.entities.RadioChannel.filter({ is_active: true }, "sort_order", 20).then(dbChannels => {
      if (dbChannels.length > 0) setChannels(dbChannels);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume[0] / 100;
    }
  }, [volume, muted]);

  const switchChannel = (ch) => {
    setActiveChannel(ch);
    setIsPlaying(false);
    setNowPlaying(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (activeChannel.stream_url) {
        audioRef.current.src = activeChannel.stream_url;
        audioRef.current.play().catch(() => {});
      }
    }
    setIsPlaying(!isPlaying);
  };

  const channelStyle = (ch) => ({
    background: `linear-gradient(135deg, ${ch.color_theme}22, ${ch.color_theme}11)`,
    borderColor: `${ch.color_theme}40`,
  });

  const activeStyle = (ch) => ({
    background: `linear-gradient(135deg, ${ch.color_theme}40, ${ch.color_theme}20)`,
    borderColor: ch.color_theme,
    boxShadow: `0 0 20px ${ch.color_theme}30`,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-10 px-6" style={{ background: `linear-gradient(135deg, ${activeChannel.color_theme}40 0%, #0a0a0a 60%)` }}>
        <motion.div key={activeChannel.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-10 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ background: activeChannel.color_theme }} />
        </motion.div>
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <RadioIcon className="w-5 h-5 text-white/60" />
            <span className="text-white/60 text-sm font-medium tracking-widest uppercase">Base Station Radio</span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Wifi className="w-3 h-3" /> Live
            </span>
          </div>
          <motion.h1 key={activeChannel.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-black text-white mb-3 tracking-tight">
            {activeChannel.emoji} {activeChannel.name}
          </motion.h1>
          <p className="text-white/60 text-lg mb-8">{activeChannel.description}</p>

          {/* Player */}
          <div className="flex items-center gap-6 p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 w-fit">
            <button onClick={togglePlay}
              className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
              style={{ background: activeChannel.color_theme }}>
              {isPlaying ? <Pause className="w-7 h-7" fill="white" /> : <Play className="w-7 h-7 ml-1" fill="white" />}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
                <span className="text-white/80 text-sm font-medium">{isPlaying ? "Now Streaming" : "Press play to tune in"}</span>
              </div>
              {nowPlaying && <p className="text-white font-bold truncate">{nowPlaying.title} — {nowPlaying.artist}</p>}
            </div>

            <div className="flex items-center gap-3 ml-4">
              <button onClick={() => setMuted(!muted)} className="text-white/60 hover:text-white transition-colors">
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <div className="w-24">
                <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="cursor-pointer" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-white/50 text-sm">
              <Headphones className="w-4 h-4" />
              <span>{activeChannel.listener_count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Grid */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-xl font-bold text-foreground mb-6">All Channels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((ch) => (
            <motion.button key={ch.id || ch.slug} onClick={() => switchChannel(ch)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="p-5 rounded-2xl border text-left transition-all"
              style={activeChannel.id === ch.id || activeChannel.slug === ch.slug ? activeStyle(ch) : channelStyle(ch)}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">{ch.emoji || "🎵"}</span>
                {(activeChannel.id === ch.id || activeChannel.slug === ch.slug) && (
                  <Badge className="text-xs" style={{ background: ch.color_theme, color: "white" }}>
                    {isPlaying ? "▶ Live" : "Active"}
                  </Badge>
                )}
              </div>
              <h3 className="font-bold text-foreground mb-1">{ch.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">{ch.description}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                <span>{ch.listener_count || 0} listening</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
    </div>
  );
}