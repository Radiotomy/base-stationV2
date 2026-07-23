import { Link } from "react-router-dom";
import { Play, Radio } from "lucide-react";

const GENRE_STYLES = {
  "pop": "from-pink-500 to-rose-600",
  "rock": "from-red-600 to-orange-700",
  "hip-hop": "from-amber-500 to-orange-600",
  "edm": "from-cyan-500 to-blue-600",
  "r&b": "from-purple-500 to-fuchsia-600",
  "lo-fi": "from-teal-500 to-emerald-600",
  "jazz": "from-indigo-500 to-violet-600",
  "other": "from-slate-500 to-slate-700",
};

// Compact horizontal shelf of auto-refreshed Audius genre stations
export default function StationShelf({ stations }) {
  if (!stations?.length) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Radio className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-black uppercase tracking-wider text-foreground">Genre Stations</h2>
        <span className="text-xs text-muted-foreground">· fresh from Audius</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {stations.map((pl) => (
          <Link key={pl.id} to={`/playlists/${pl.id}`} className="group shrink-0 w-32 sm:w-36">
            <div className={`relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br ${GENRE_STYLES[pl.genre] || GENRE_STYLES.other} shadow-md`}>
              {pl.cover_image_url && (
                <img src={pl.cover_image_url} alt={pl.title} loading="lazy" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                <p className="text-white text-xs font-bold leading-tight line-clamp-2">{pl.title}</p>
              </div>
              <div className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="white" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 px-0.5">{pl.track_count || 0} tracks</p>
          </Link>
        ))}
      </div>
    </div>
  );
}