import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Radio, Zap, X, Music2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ChipSelector from "@/components/music/ChipSelector";

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
      const res = await base44.functions.invoke("buildRadioPlaylist", {
        genre,
        mood,
        name: playlistName,
        description: `Auto-generated radio playlist — ${genre} / ${mood} — top community tracks`,
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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.96, y: 30 }} animate={{ scale: 1, y: 0 }}
        className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-foreground">Build Radio Playlist</h2>
              <p className="text-xs text-muted-foreground">Curate top community tracks by genre</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto overscroll-contain flex-1">
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
                <ChipSelector
                  chipType="genre"
                  defaults={GENRES}
                  selected={genre}
                  onSelect={setGenre}
                  activeClass="bg-purple-600 text-white"
                />
              </div>

              {/* Mood */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Mood</p>
                <ChipSelector
                  chipType="mood"
                  defaults={MOODS}
                  selected={mood}
                  onSelect={setMood}
                  activeClass="bg-pink-600 text-white"
                />
              </div>

              {/* Info */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
                <p className="font-semibold">What gets mixed in:</p>
                <p>🎤 Top approved community submissions for this genre, ranked by likes</p>
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
                <span className="flex items-center gap-1"><Music2 className="w-3 h-3 text-emerald-400" /> {result.community_count} Community tracks</span>
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