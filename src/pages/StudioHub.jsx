import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Music, Sliders, Palette, Send, BarChart3, Folder, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StudioCategoryCard from "@/components/studios/StudioCategoryCard";

const CATEGORIES = [
  {
    title: "Create",
    subtitle: "Generate from scratch",
    icon: Music,
    accent: "bg-gradient-to-br from-violet-600 to-fuchsia-600",
    studios: [
      { to: "/music-studio",       emoji: "🎵", label: "Music Studio",       desc: "Generate full tracks with AI" },
      { to: "/cover-song-studio",  emoji: "🎙️", label: "Cover & Extend Studio", desc: "Cover or extend any uploaded track" },
      { to: "/lyrics-studio",      emoji: "🎤", label: "Lyrics Studio",      desc: "Write song lyrics with AI" },
      { to: "/voice-creator",      emoji: "🗣️", label: "Voice Creator",      desc: "Custom AI voices & personas" },
      { to: "/sfx-studio",         emoji: "💥", label: "Sound FX Studio",    desc: "Text-to-SFX with ElevenLabs" },
    ],
  },
  {
    title: "Enhance & Edit",
    subtitle: "Refine your audio",
    icon: Sliders,
    accent: "bg-gradient-to-br from-cyan-600 to-blue-600",
    studios: [
      { to: "/mastering-studio",  emoji: "🎚️", label: "Mastering Studio",  desc: "AI mastering & polish" },
      { to: "/audio-remix-studio", emoji: "🎛️", label: "Audio Remix",       desc: "Edit, effects & remix" },
      { to: "/stem-creator",       emoji: "🧬", label: "Stem Creator",       desc: "Split vocals, drums, bass" },
      { to: "/mashup-studio",      emoji: "🔀", label: "Mashup Studio",      desc: "Blend multiple tracks" },
      { to: "/vocal-harmonizer",   emoji: "🎼", label: "Vocal Harmonizer",   desc: "Add AI harmony layers" },
      { to: "/id3-studio",         emoji: "🏷️", label: "ID3 Tag Editor",     desc: "Edit metadata & tags" },
    ],
  },
  {
    title: "Visuals",
    subtitle: "Bring it to life",
    icon: Palette,
    accent: "bg-gradient-to-br from-pink-600 to-rose-600",
    studios: [
      { to: "/cover-art-studio",  emoji: "🎨", label: "Cover Art Studio",  desc: "AI album & track art" },
      { to: "/video-studio",      emoji: "🎬", label: "Video Studio",      desc: "Music videos & b-roll", beta: true },
      { to: "/visualizer-studio", emoji: "🌈", label: "Visualizer Studio", desc: "Audio-reactive visuals" },
    ],
  },
  {
    title: "Perform Live",
    subtitle: "Stream to your fans",
    icon: Radio,
    accent: "bg-gradient-to-br from-red-600 to-orange-600",
    studios: [
      { to: "/live-studio",   emoji: "🔴", label: "Live Studio",   desc: "Go live with synced playback & 3D venues", beta: true },
      { to: "/live-manager",  emoji: "🗂️", label: "Live Manager",  desc: "Manage sessions, venues & moderation" },
    ],
  },
  {
    title: "Publish & Promote",
    subtitle: "Get heard",
    icon: Send,
    accent: "bg-gradient-to-br from-emerald-600 to-teal-600",
    studios: [
      { to: "/submit",             emoji: "📤", label: "Submit Track",      desc: "Charts, radio, distribution" },
      { to: "/promo-studio",       emoji: "📣", label: "Promo Package",     desc: "Visualizer + promo card bundle" },
      { to: "/social-automation",  emoji: "📱", label: "Social Automation", desc: "Promo cards for socials" },
      { to: "/asset-gallery",      emoji: "🖼️", label: "Asset Gallery",     desc: "Browse public creations" },
    ],
  },
];

export default function StudioHub() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden pt-16 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 bg-white/10 text-white/80 border-white/15 px-3 py-1 text-xs tracking-widest uppercase">
              🎛️ Studio Hub
            </Badge>
            <h1 className="text-5xl md:text-6xl font-black text-foreground mb-3 tracking-tight">
              Every <span className="text-iridescent">Creative Tool</span>, One Place
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Generate, edit, master, visualize, and publish — all from a single hub.
              Pick a category and dive in.
            </p>

            {/* Quick actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/creator-dashboard">
                <Button variant="outline" className="rounded-full gap-2">
                  <BarChart3 className="w-4 h-4" /> My Workspace
                </Button>
              </Link>
              <Link to="/asset-gallery">
                <Button variant="outline" className="rounded-full gap-2">
                  <Folder className="w-4 h-4" /> My Library
                </Button>
              </Link>
              <Link to="/ai-studio/history">
                <Button variant="outline" className="rounded-full gap-2">
                  <Sparkles className="w-4 h-4" /> Generation History
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CATEGORIES.map((cat, i) => (
            <StudioCategoryCard key={cat.title} {...cat} index={i} />
          ))}
        </div>

        {/* Suggested workflow */}
        <div className="mt-10 p-6 rounded-2xl bg-white/[0.03] border border-white/10">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Suggested Workflow
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/80">
            <span className="px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30">🎤 Write Lyrics</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30">🎵 Generate Music</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30">🎚️ Master</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30">🎨 Cover Art</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">📤 Submit</span>
          </div>
        </div>
      </div>
    </div>
  );
}