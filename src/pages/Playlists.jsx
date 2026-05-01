import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Music, Play, Heart, Search, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence } from "framer-motion";
import CreatePlaylistModal from "@/components/playlists/CreatePlaylistModal";
import RadioPlaylistBuilder from "@/components/radio/RadioPlaylistBuilder";

const GENRES = ["all", "hip-hop", "edm", "pop", "r&b", "rock", "lo-fi", "jazz", "trap", "other"];

export default function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("featured"); // featured | mine | all
  const [genre, setGenre] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showRadioBuilder, setShowRadioBuilder] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setLoading(true);
    const data = await base44.entities.Playlist.list("-created_date", 50);
    setPlaylists(data);
    setLoading(false);
  };

  const filtered = playlists.filter(p => {
    const matchesTab = tab === "featured" ? p.is_featured
      : tab === "mine" ? p.created_by === user?.email
      : tab === "community" ? !p.is_featured && p.is_public
      : true;
    const matchesGenre = genre === "all" || p.genre === genre;
    const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.owner_name?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesGenre && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 pt-20 pb-16 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent" />
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge className="mb-4 bg-purple-500/20 text-purple-300 border-purple-500/30 px-4 py-1.5 text-xs tracking-widest uppercase">
              ♪ Community Playlists
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
              Curate the <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Vibe</span>
            </h1>
            <p className="text-purple-200/70 text-lg max-w-xl mx-auto mb-8">
              Build and discover playlists from the world's most creative AI music artists.
            </p>
            {user && (
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={() => setShowCreate(true)} className="bg-white text-purple-900 hover:bg-purple-50 font-bold px-8 py-3 rounded-full text-sm">
                  <Plus className="w-4 h-4 mr-2" /> Create Playlist
                </Button>
                <Button onClick={() => setShowRadioBuilder(true)} className="bg-purple-600/80 hover:bg-purple-600 border border-purple-400/40 text-white font-bold px-8 py-3 rounded-full text-sm">
                  <Radio className="w-4 h-4 mr-2" /> Build Radio Mix
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Tabs */}
          <div className="flex gap-2 bg-muted/50 rounded-xl p-1 w-fit flex-wrap">
            {[["featured", "⭐ Featured"], ["community", "🎧 Fan Picks"], ["all", "🌍 All"], ["mine", "👤 Mine"]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? "bg-white dark:bg-zinc-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search playlists…" className="pl-9 rounded-xl" />
          </div>
        </div>

        {/* Genre Filter */}
        <div className="flex gap-2 flex-wrap mb-8">
          {GENRES.map(g => (
            <button key={g} onClick={() => setGenre(g)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${genre === g ? "bg-purple-600 border-purple-600 text-white" : "border-border text-muted-foreground hover:border-purple-500 hover:text-purple-400"}`}>
              {g}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Music className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No playlists found</p>
            <p className="text-sm mt-1">Be the first to create one!</p>
            {user && <Button onClick={() => setShowCreate(true)} className="mt-6 rounded-full">Create Playlist</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {filtered.map((pl, i) => (
              <PlaylistCard key={pl.id} playlist={pl} index={i} />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreatePlaylistModal onClose={() => setShowCreate(false)} onCreated={loadPlaylists} />}
      <AnimatePresence>
        {showRadioBuilder && (
          <RadioPlaylistBuilder
            onClose={() => setShowRadioBuilder(false)}
            onCreated={() => { setShowRadioBuilder(false); loadPlaylists(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PlaylistCard({ playlist, index }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link to={`/playlists/${playlist.id}`} className="group block">
        <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 bg-gradient-to-br from-purple-800 to-indigo-900 shadow-lg">
          {playlist.cover_image_url ? (
            <img src={playlist.cover_image_url} alt={playlist.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-12 h-12 text-white/30" />
            </div>
          )}
          {playlist.is_featured && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-yellow-500/90 text-yellow-900 text-xs px-2 py-0.5 font-bold">⭐ Featured</Badge>
            </div>
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center shadow-xl">
              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
            </div>
          </div>
        </div>
        <h3 className="font-bold text-sm truncate text-foreground group-hover:text-purple-400 transition-colors">{playlist.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{playlist.track_count || 0} tracks · {playlist.owner_name || "Anonymous"}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Heart className="w-3 h-3" />{playlist.like_count || 0}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Play className="w-3 h-3" />{playlist.play_count || 0}</span>
          {playlist.genre && <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize border-border">{playlist.genre}</Badge>}
        </div>
      </Link>
    </motion.div>
  );
}