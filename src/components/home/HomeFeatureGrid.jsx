import { Link } from "react-router-dom";
import {
  Radio, TrendingUp, Music, Star, Zap, ArrowRight,
  Mic2, Headphones, Globe, Upload, Film, Palette,
} from "lucide-react";

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
  // Multi-Chain Registry hidden for now — restore when blockchain features return:
  // { to: "/blockchain", icon: Globe, title: "Multi-Chain Registry", badge: "New" },
  { to: "/templates", icon: Zap, title: "Community Templates", badge: "New" },
  { to: "/audius-trending", icon: Headphones, title: "Audius Network", badge: "Live" },
  { to: "/stem-creator", icon: Music, title: "Stem Creator", badge: "New" },
  { to: "/mashup-studio", icon: Music, title: "Mashup Studio", badge: "Pro" },
  { to: "/vocal-harmonizer", icon: Mic2, title: "Vocal Harmonizer", badge: "Pro" },
  { to: "/mastering-studio", icon: Star, title: "AI Mastering", badge: "Pro" },
  { to: "/visualizer-studio", icon: Film, title: "Visualizer Studio", badge: "Live" },
  { to: "/ai-studio/history", icon: Zap, title: "Studio History", badge: "New" },
];

const BADGE_STYLES = {
  New: "text-[#C6F27E] border-[#C6F27E]/40 bg-[#0C120A]",
  Live: "text-[#C6F27E] border-[#C6F27E]/40 bg-[#0C120A] shadow-[0_0_8px_rgba(198,242,126,0.35)]",
  Hot: "text-[#FF9A4D] border-[#FF9A4D]/40 bg-[#1A0E06]",
  Pro: "text-[#FF9A4D] border-[#FF9A4D]/40 bg-[#1A0E06]",
};

export default function HomeFeatureGrid() {
  return (
    <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#1C1712] to-[#0F0C09] p-3 sm:p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {FEATURES.map(({ to, icon: Icon, title, badge }) => (
          <Link
            key={title}
            to={to}
            className="group rounded-md border border-black/80 p-3 bg-gradient-to-b from-[#28211A] to-[#171310] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-[#FF9A4D]/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2.5">
              <Icon className="w-4 h-4 text-white/60" />
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${BADGE_STYLES[badge] || BADGE_STYLES.New}`}>
                {badge}
              </span>
            </div>
            <h3 className="font-bold text-xs text-[#E8E0D0] mb-2 leading-tight">{title}</h3>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-white/40 text-[10px] font-semibold group-hover:text-[#FF9A4D]">
                Explore <ArrowRight className="w-3 h-3" />
              </span>
              <span className="w-7 h-3.5 rounded-full bg-black shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)] flex items-center px-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#E8E8E8] to-[#8A8A8A] group-hover:translate-x-3.5 transition-transform" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}