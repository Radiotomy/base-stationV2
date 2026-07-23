import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import PlaylistPlayerBar from "@/components/playlists/PlaylistPlayerBar";
import { motion } from "framer-motion";
import { Play, Pause, Music, Plus, ArrowLeft, Heart, Share2, MoreHorizontal, Clock, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function PlaylistDetail() {
  const { id } = useParams();
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [volume, setVolume] = useState([70]);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef(null);

  // Keep the audio element in sync with the volume controls
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume[0] / 100;
  }, [volume, muted]);

  // Load + play the selected track whenever the index changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el || playingIndex === null) return;
    const track = tracks[playingIndex];
    if (!track?.audio_url) {
      toast.error("This track has no audio available");
      setIsPlaying(false);
      return;
    }
    setAudioLoading(true);
    el.src = track.audio_url;
    el.play()
      .then(() => { setIsPlaying(true); setAudioLoading(false); })
      .catch(() => { setIsPlaying(false); setAudioLoading(false); });
  }, [playingIndex, tracks]);

  const playIndex = (i) => {
    if (i === playingIndex) { togglePlay(); return; }
    setPlayingIndex(i);
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) { el.pause(); setIsPlaying(false); }
    else if (el.src) { el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); }
    else if (tracks.length > 0) { setPlayingIndex(0); }
  };

  const skipNext = () => { if (tracks.length > 0) setPlayingIndex((playingIndex + 1) % tracks.length); };
  const skipPrev = () => { if (tracks.length > 0) setPlayingIndex((playingIndex - 1 + tracks.length) % tracks.length); };

  // Broken/unreachable track → skip to the next one
  const handleAudioError = () => {
    if (playingIndex === null || tracks.length < 2) { setIsPlaying(false); setAudioLoading(false); return; }
    toast.error(`"${tracks[playingIndex]?.track_title}" couldn't load — skipping`);
    skipNext();
  };

  useEffect(() => {
    const el = audioRef.current;
    return () => { el?.pause(); };
  }, []);

  useEffect(() => {
    Promise.all([
      base44.entities.Playlist.filter({ id }),
      base44.entities.PlaylistTrack.filter({ playlist_id: id }, "position", 100)
    ]).then(([pls, trks]) => {
      setPlaylist(pls[0] || null);
      setTracks(trks);
      setLoading(false);
    });
  }, [id]);

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration_seconds || 0), 0);
  const fmtDuration = (s) => {
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  };

  const fmtTrackDuration = (s) => {
    if (!s) return "--:--";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  if (!playlist) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
      Playlist not found.
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-purple-950/80 to-background pt-8 pb-10 px-6">
        <Link to="/playlists" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Playlists
        </Link>

        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8 items-end">
          {/* Cover */}
          <div className="w-52 h-52 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-800 to-indigo-900 shadow-2xl shadow-purple-900/50">
            {playlist.cover_image_url ? (
              <img src={playlist.cover_image_url} alt={playlist.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-16 h-16 text-white/20" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            {playlist.is_featured && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 mb-3">⭐ Featured Collection</Badge>}
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Playlist</p>
            <h1 className="text-4xl md:text-5xl font-black text-foreground mb-3">{playlist.title}</h1>
            {playlist.description && <p className="text-muted-foreground mb-4 max-w-lg">{playlist.description}</p>}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{playlist.owner_name || "AIVTV"}</span>
              <span>·</span>
              <span>{tracks.length} tracks</span>
              {totalDuration > 0 && <><span>·</span><span>{fmtDuration(totalDuration)}</span></>}
              {playlist.genre && <><span>·</span><Badge variant="outline" className="capitalize text-xs">{playlist.genre}</Badge></>}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="max-w-5xl mx-auto mt-6 flex items-center gap-4">
          <Button onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 p-0 shadow-xl shadow-purple-900/40">
            {isPlaying ? <Pause className="w-6 h-6" fill="white" /> : <Play className="w-6 h-6 ml-0.5" fill="white" />}
          </Button>
          <Button variant="outline" size="icon" className="rounded-full w-10 h-10"
            onClick={() => { if (tracks.length > 0) setPlayingIndex(Math.floor(Math.random() * tracks.length)); }}>
            <Shuffle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setLiked(!liked); toast.success(liked ? "Removed from likes" : "Added to likes"); }}>
            <Heart className={`w-5 h-5 ${liked ? "fill-red-500 text-red-500" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); }}>
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Track List */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        {tracks.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">This playlist is empty</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header Row */}
            <div className="grid grid-cols-[2rem_1fr_auto] md:grid-cols-[2rem_1fr_1fr_auto] gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border mb-2">
              <span>#</span>
              <span>Title</span>
              <span className="hidden md:block">Artist</span>
              <span><Clock className="w-3.5 h-3.5" /></span>
            </div>

            {tracks.map((track, i) => {
              const isActive = playingIndex === i;
              return (
                <motion.div key={track.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                  onClick={() => playIndex(i)}
                  className={`group grid grid-cols-[2rem_1fr_auto] md:grid-cols-[2rem_1fr_1fr_auto] gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all ${isActive ? "bg-purple-600/20 border border-purple-500/30" : "hover:bg-muted/50"}`}>
                  <div className="flex items-center">
                    {isActive && isPlaying ? (
                      <div className="flex gap-0.5 items-end h-4">
                        <div className="w-0.5 bg-purple-400 animate-bounce" style={{ height: "60%", animationDelay: "0ms" }} />
                        <div className="w-0.5 bg-purple-400 animate-bounce" style={{ height: "100%", animationDelay: "150ms" }} />
                        <div className="w-0.5 bg-purple-400 animate-bounce" style={{ height: "40%", animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <>
                        <span className={`text-sm group-hover:hidden ${isActive ? "text-purple-400 font-bold" : "text-muted-foreground"}`}>{i + 1}</span>
                        <Play className="w-4 h-4 hidden group-hover:block text-foreground" />
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-800 to-indigo-900 flex-shrink-0 overflow-hidden">
                      {track.cover_image_url ? <img src={track.cover_image_url} alt={track.track_title} className="w-full h-full object-cover" /> : <Music className="w-4 h-4 m-3 text-white/30" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm truncate ${isActive ? "text-purple-400" : "text-foreground"}`}>{track.track_title}</p>
                      <p className="text-xs text-muted-foreground truncate md:hidden">{track.artist_name}</p>
                    </div>
                  </div>

                  <p className="hidden md:flex items-center text-sm text-muted-foreground truncate">{track.artist_name}</p>
                  <div className="flex items-center text-sm text-muted-foreground">{fmtTrackDuration(track.duration_seconds)}</div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <audio ref={audioRef} onEnded={skipNext} onError={handleAudioError} />
      {playingIndex !== null && (
        <PlaylistPlayerBar
          track={tracks[playingIndex]}
          isPlaying={isPlaying}
          isLoading={audioLoading}
          onToggle={togglePlay}
          onNext={skipNext}
          onPrev={skipPrev}
          volume={volume}
          muted={muted}
          onVolumeChange={setVolume}
          onMuteToggle={() => setMuted(m => !m)}
        />
      )}
    </div>
  );
}