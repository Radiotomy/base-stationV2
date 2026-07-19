import { Link } from "react-router-dom";
import {
  Radio, TrendingUp, Music, Star, Zap,
  Mic2, Headphones, Upload, Film, Palette,
} from "lucide-react";

// Features organized by type — compact chip layout keeps the footprint small
const CATEGORIES = [
  {
    label: "Create",
    accent: "#C6F27E",
    items: [
      { to: "/music-studio", icon: Music, title: "Music Studio" },
      { to: "/lyrics-studio", icon: Mic2, title: "Lyrics Studio" },
      { to: "/voice-creator", icon: Mic2, title: "Voice Creator" },
      { to: "/sfx-studio", icon: Zap, title: "Sound FX" },
      { to: "/templates", icon: Zap, title: "Templates" },
    ],
  },
  {
    label: "Enhance & Master",
    accent: "#FF9A4D",
    items: [
      { to: "/mastering-studio", icon: Star, title: "AI Mastering" },
      { to: "/stem-creator", icon: Music, title: "Stem Creator" },
      { to: "/mashup-studio", icon: Music, title: "Mashup Studio" },
      { to: "/vocal-harmonizer", icon: Mic2, title: "Vocal Harmonizer" },
      { to: "/cover-song-studio", icon: Music, title: "Cover & Extend" },
      { to: "/audio-remix-studio", icon: Headphones, title: "Audio Remix" },
    ],
  },
  {
    label: "Visuals & Video",
    accent: "#FFC98A",
    items: [
      { to: "/cover-art-studio", icon: Palette, title: "Cover Art" },
      { to: "/video-studio", icon: Film, title: "Video Studio" },
      { to: "/visualizer-studio", icon: Film, title: "Visualizer" },
    ],
  },
  {
    label: "Live & Discover",
    accent: "#C6F27E",
    items: [
      { to: "/live-studio", icon: Radio, title: "Live Studio" },
      { to: "/radio", icon: Radio, title: "Radio" },
      { to: "/charts", icon: TrendingUp, title: "Charts" },
      { to: "/playlists", icon: Music, title: "Playlists" },
      { to: "/featured-artists", icon: Star, title: "Featured Artists" },
      { to: "/audius-trending", icon: Headphones, title: "Audius Network" },
    ],
  },
  {
    label: "Publish & Promote",
    accent: "#FF9A4D",
    items: [
      { to: "/submit", icon: Upload, title: "Submit Track" },
      { to: "/promo-studio", icon: Star, title: "Promo Package" },
      { to: "/id3-studio", icon: Music, title: "ID3 Tags" },
      { to: "/ai-studio/history", icon: Zap, title: "Studio History" },
    ],
  },
];

export default function HomeFeatureGrid() {
  return (
    <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#1C1712] to-[#0F0C09] p-3 sm:p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] space-y-3">
      {CATEGORIES.map(({ label, accent, items }) => (
        <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:w-36 flex-shrink-0">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}` }}
            />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/50">{label}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map(({ to, icon: Icon, title }) => (
              <Link
                key={title}
                to={to}
                className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-black/80 bg-gradient-to-b from-[#28211A] to-[#171310] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-[#FF9A4D]/50 transition-colors"
              >
                <Icon className="w-3 h-3 text-white/50 group-hover:text-[#FF9A4D] transition-colors" />
                <span className="text-[11px] font-bold text-[#E8E0D0] group-hover:text-white whitespace-nowrap">{title}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}