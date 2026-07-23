import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Music, ListMusic } from "lucide-react";

// Saved playlists shelf on the Radio page — links into the playlist player
export default function RadioPlaylistShelf() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Playlist.filter({ is_public: true }, "-created_date", 12)
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-xs text-white/40 font-mono py-4 text-center">LOADING PLAYLISTS…</p>;
  if (playlists.length === 0) {
    return (
      <p className="text-xs text-white/40 font-mono py-4 text-center">
        No playlists yet — use "Build Mix" to create one.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {playlists.map((p) => (
        <Link key={p.id} to={`/playlists/${p.id}`}
          title={`Open "${p.title}" — ${p.track_count || 0} tracks`}
          className="p-3 rounded-lg text-left border bg-[#131A0C] border-[#C6F27E]/15 hover:border-[#C6F27E]/40 transition-all block">
          <div className="w-full aspect-square rounded-md overflow-hidden mb-2 bg-black/40 flex items-center justify-center">
            {p.cover_image_url
              ? <img src={p.cover_image_url} alt={p.title} className="w-full h-full object-cover" />
              : <Music className="w-6 h-6 text-[#C6F27E]/30" />}
          </div>
          <h3 className="font-bold text-sm leading-tight text-[#A8C97E] truncate">{p.title}</h3>
          <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
            <ListMusic className="w-3 h-3" /> {p.track_count || 0} tracks
          </p>
        </Link>
      ))}
    </div>
  );
}