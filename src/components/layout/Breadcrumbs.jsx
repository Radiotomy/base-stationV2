import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_NAMES = {
  "/": "Home",
  "/radio": "Radio",
  "/charts": "Charts",
  "/playlists": "Playlists",
  "/challenges": "Challenges",
  "/leaderboard": "Leaderboard",
  "/blockchain": "Multi-Chain Registry",
  "/featured-artists": "Featured Artists",
  "/creator-dashboard": "My Studio",
  "/music-studio": "Music Studio",
  "/lyrics-studio": "Lyrics Studio",
  "/video-studio": "Video Studio",
  "/live-studio": "Live Studio",
  "/submit": "Submit Track",
  "/ai-studio": "AI Tools",
};

export default function Breadcrumbs() {
  const location = useLocation();
  const path = location.pathname;

  if (path === "/") return null;

  const segments = path.split("/").filter(Boolean);
  const breadcrumbs = [
    { label: "Home", path: "/" },
    ...segments.map((segment, i) => {
      const fullPath = "/" + segments.slice(0, i + 1).join("/");
      return {
        label: ROUTE_NAMES[fullPath] || segment.replace(/-/g, " "),
        path: fullPath,
      };
    }),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 border-b border-border/50">
      <div className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.path} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            {i === breadcrumbs.length - 1 ? (
              <span className="text-foreground font-medium">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}