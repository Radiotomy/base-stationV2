import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Radio, Zap, X, Music2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const GENRES = ["hip-hop", "edm", "pop", "r&b", "rock", "lo-fi", "jazz", "trap", "ambient", "other"];
const MOODS  = ["Energetic", "Chill", "Dark", "Happy", "Uplifting", "Romantic"];

export default function RadioPlaylistBuilder({ onCreated, onClose }) {
  const [genre, setGenre] = useState("hip-hop");
  const [mood, setMood] = useState("Energetic");
  const [name, setName] = useState("");
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState(null);

  const build = async () => {
    setBuilding(true);
    try {
      const playlistName = name || `${genre.toUpperCase()} Radio Mix`;
      const res = await base44.functions.invoke("loudlyCatalog", {
        action: "build_playlist",
        genre,
        mood,
        name: playlistName,
        description: `Auto-generated radio playlist — ${genre} / ${mood} — Loudly catalog + community tracks`,
      });
      setResult(res.data);
      toast.success(`Playlist built! ${res.data?.track_count || 0} tracks added.`);
      if (onCreated) onCreated();
    } catch (e) {
      toast.error(e.message);
    }
    setBuilding(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-foreground">Build Radio Playlist</h2>
              <p className="text-xs text-muted-foreground">Mix Loudly catalog + community tracks</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!result ? (
            <>
              {/* Name */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Playlist Name (optional)</p>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Friday Night EDM Mix" className="rounded-xl" />
              </div>

              {/* Genre */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Genre</p>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map(g => (
                    <button key={g} type="button" onClick={() => setGenre(g)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${genre === g ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Mood</p>
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.map(m => (
                    <button key={m} type="button" onClick={() => setMood(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mood === m ? "bg-pink-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
                <p className="font-semibold">What gets mixed in:</p>
                <p>🎵 Loudly catalog tracks matching your genre/mood</p>
                <p>🎤 Top approved community submissions for this genre</p>
              </div>

              <Button onClick={build} disabled={building} className="w-full bg-purple-600 hover:bg-purple-500 rounded-xl font-bold gap-2">
                <Zap className="w-4 h-4" />
                {building ? "Building playlist…" : "Build Radio Playlist"}
              </Button>
            </>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="font-black text-foreground text-lg">{result.playlist?.title}</p>
                <p className="text-muted-foreground text-sm mt-1">{result.track_count} tracks added</p>
              </div>
              <div className="flex gap-3 justify-center text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Music2 className="w-3 h-3 text-blue-400" /> {result.loudly_count} Loudly</span>
                <span className="flex items-center gap-1"><Music2 className="w-3 h-3 text-emerald-400" /> {result.community_count} Community</span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">Close</Button>
                <Button onClick={() => { setResult(null); setName(""); }} className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500">
                  Build Another
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}