import { Link, useLocation } from "react-router-dom";
import { Radio, TrendingUp, Music, Star, Home, Headphones, Mic2, Film, Zap } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/music-studio", icon: Music, label: "Music" },
  { path: "/lyrics-studio", icon: Mic2, label: "Lyrics" },
  { path: "/video-studio", icon: Film, label: "Video" },
  { path: "/radio", icon: Radio, label: "Radio" },
  { path: "/charts", icon: TrendingUp, label: "Charts" },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-card border-t border-border flex items-center justify-around h-20 px-2 z-40">
      {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
        const isActive = location.pathname === path;
        return (
          <Link
            key={path}
            to={path}
            className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all ${
              isActive
                ? "text-purple-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs font-medium truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}