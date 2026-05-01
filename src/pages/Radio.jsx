import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX, Radio as RadioIcon, Wifi,
  SkipForward, SkipBack, Music, Loader2, ListMusic, RefreshCw, Plus
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import RadioPlaylistBuilder from "@/components/radio/RadioPlaylistBuilder";

// Genres match Loudly's exact tag values from GET /api/songs/tags
const DEFAULT_CHANNELS = [
  { id: "discover",   name: "Discover",         slug: "discover",  genre: null,              emoji: "🌟", color_theme: "#7C3AED", description: "Fresh AI music from Loudly + the community" },
  { id: "hiphop",     name: "Hip-Hop & Trap",   slug: "hiphop",    genre: "Hip Hop & Trap",  emoji: "🎤", color_theme: "#EF4444", description: "AI beats, bars & trap bangers" },
  { id: "edm",        name: "EDM",               slug: "edm",       genre: "EDM",             emoji: "⚡", color_theme: "#06B6D4", description: "Synths, drops & AI energy" },
  { id: "rb",         name: "Soul / R&B",        slug: "rb",        genre: "Soul/R&B",        emoji: "🎵", color_theme: "#EC4899", description: "Smooth AI R&B and neo-soul" },
  { id: "lofi",       name: "Lo-Fi",             slug: "lofi",      genre: "Lo-Fi",           emoji: "☕", color_theme: "#84CC16", description: "Chill beats to create and relax" },
  { id: "pop",        name: "Pop",               slug: "pop",       genre: "Pop",             emoji: "💫", color_theme: "#F59E0B", description: "Catchy AI pop from Loudly + creators" },
  { id: "house",      name: "House",             slug: "house",     genre: "House",           emoji: "🏠", color_theme: "#8B5CF6", description: "Deep & progressive house beats" },
  { id: "cinematic",  name: "Cinematic",         slug: "cinematic", genre: "Cinematic",       emoji: "🎬", color_theme: "#6366F1", description: "Cinematic scores & epic soundscapes" },
];

const SOURCE_BADGE = {
  loudly:    { label: "Loudly",    cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  community: { label: "Community", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
};

export default function Radio() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [activeChannel, setActiveChannel] = useState(DEFAULT_CHANNELS[0]);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [muted, setMuted] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const audioRef = useRef(null);

  const nowPlaying = queue[queueIndex] || null;

  // Load DB channels
  useEffect(() => {
    base44.entities.RadioChannel.filter({ is_active: true }, "sort_order", 20)
      .then(dbChs => { if (dbChs.length > 0) setChannels(dbChs); })
      .catch(() => {});
  }, []);

  // Volume / mute sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume[0] / 100;
    }
  }, [volume, muted]);

  // Load queue when channel changes
  const loadQueue = useCallback(async (ch) => {
    setLoadingQueue(true);
    setQueue([]);
    setQueueIndex(0);
    setIsPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }

    try {
      const res = await base44.functions.invoke('loudlyCatalog', {
        action: 'radio_queue',
        genre: ch.genre || undefined,
        limit: 15,
      });
      const q = res.data?.queue || [];
      setQueue(q);
      setLoadingQueue(false);
      if (q.length > 0) {
        playTrack(q[0]);
      } else {
        toast.info("No tracks available for this channel yet — submit tracks to the community or upgrade Loudly plan.");
      }
    } catch (e) {
      setLoadingQueue(false);
      toast.error("Couldn't load channel: " + e.message);
    }
  }, []);

  useEffect(() => {
    loadQueue(activeChannel);
  }, [activeChannel]);

  const playTrack = (track) => {
    if (!track?.audio_url || !audioRef.current) return;
    audioRef.current.src = track.audio_url;
    audioRef.current.play().catch(() => setIsPlaying(false));
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (nowPlaying?.audio_url) {
        if (!audioRef.current.src || audioRef.current.src === window.location.href) {
          audioRef.current.src = nowPlaying.audio_url;
        }
        audioRef.current.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
      }
    }
  };

  const skipNext = () => {
    const next = (queueIndex + 1) % queue.length;
    setQueueIndex(next);
    playTrack(queue[next]);
  };

  const skipPrev = () => {
    const prev = (queueIndex - 1 + queue.length) % queue.length;
    setQueueIndex(prev);
    playTrack(queue[prev]);
  };

  const handleTrackEnd = () => {
    skipNext();
  };

  const switchChannel = (ch) => {
    setActiveChannel(ch);
  };

  const channelStyle = (ch) => ({
    background: `linear-gradient(135deg, ${ch.color_theme}22, ${ch.color_theme}11)`,
    borderColor: `${ch.color_theme}40`,
  });

  const activeStyle = (ch) => ({
    background: `linear-gradient(135deg, ${ch.color_theme}40, ${ch.color_theme}20)`,
    borderColor: ch.color_theme,
    boxShadow: `0 0 20px ${ch.color_theme}30`,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero / Player */}
      <div className="relative overflow-hidden pt-20 pb-10 px-6" style={{ background: `linear-gradient(135deg, ${activeChannel.color_theme}40 0%, #0a0a0a 60%)` }}>
        <motion.div key={activeChannel.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-10 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ background: activeChannel.color_theme }} />
        </motion.div>

        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <RadioIcon className="w-5 h-5 text-white/60" />
            <span className="text-white/60 text-sm font-medium tracking-widest uppercase">Base Station Radio</span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Wifi className="w-3 h-3" /> Live
            </span>
          </div>

          <motion.h1 key={activeChannel.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-black text-white mb-2 tracking-tight">
            {activeChannel.emoji} {activeChannel.name}
          </motion.h1>
          <p className="text-white/50 text-base mb-6">{activeChannel.description}</p>

          {/* Now Playing info */}
          <AnimatePresence mode="wait">
            {nowPlaying && (
              <motion.div key={nowPlaying.track_title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 mb-5">
                {nowPlaying.cover_image_url ? (
                  <img src={nowPlaying.cover_image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-white/20 flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Music className="w-5 h-5 text-white/40" />
                  </div>
                )}
                <div>
                  <p className="text-white font-bold leading-tight truncate max-w-xs">{nowPlaying.track_title}</p>
                  <p className="text-white/50 text-xs">{nowPlaying.artist_name}</p>
                </div>
                {nowPlaying.source && (
                  <Badge className={`text-xs border ${SOURCE_BADGE[nowPlaying.source]?.cls || ""}`}>
                    {SOURCE_BADGE[nowPlaying.source]?.label || nowPlaying.source}
                  </Badge>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Player Controls */}
          <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 w-fit flex-wrap">
            {/* Prev */}
            <button onClick={skipPrev} disabled={queue.length < 2} className="text-white/60 hover:text-white transition-colors disabled:opacity-30">
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Play/Pause */}
            <button onClick={togglePlay} disabled={loadingQueue || queue.length === 0}
              className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              style={{ background: activeChannel.color_theme }}>
              {loadingQueue ? <Loader2 className="w-6 h-6 animate-spin" /> : isPlaying ? <Pause className="w-6 h-6" fill="white" /> : <Play className="w-6 h-6 ml-0.5" fill="white" />}
            </button>

            {/* Next */}
            <button onClick={skipNext} disabled={queue.length < 2} className="text-white/60 hover:text-white transition-colors disabled:opacity-30">
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Playing status */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPlaying ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
                <span className="text-white/70 text-sm font-medium">
                  {loadingQueue ? "Loading channel…" : isPlaying ? "Streaming" : nowPlaying ? "Paused" : "No tracks"}
                </span>
              </div>
              {queue.length > 0 && (
                <p className="text-white/40 text-xs mt-0.5">{queueIndex + 1} / {queue.length} tracks</p>
              )}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3 ml-2">
              <button onClick={() => setMuted(!muted)} className="text-white/60 hover:text-white transition-colors">
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <div className="w-24">
                <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="cursor-pointer" />
              </div>
            </div>

            {/* Queue toggle */}
            <button onClick={() => setShowQueue(p => !p)} className={`text-white/60 hover:text-white transition-colors ml-1 ${showQueue ? "text-white" : ""}`}>
              <ListMusic className="w-5 h-5" />
            </button>

            {/* Reload queue */}
            <button onClick={() => loadQueue(activeChannel)} className="text-white/40 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Queue Panel */}
          <AnimatePresence>
            {showQueue && queue.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-4 bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden max-w-lg">
                <div className="p-3 border-b border-white/10 flex items-center justify-between">
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Up Next — {queue.length} tracks</p>
                  <div className="flex gap-2 text-xs text-white/40">
                    <span>{queue.filter(t => t.source === 'loudly').length} Loudly</span>
                    <span>·</span>
                    <span>{queue.filter(t => t.source === 'community').length} Community</span>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {queue.map((t, i) => (
                    <button key={i} onClick={() => { setQueueIndex(i); playTrack(t); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors ${i === queueIndex ? "bg-white/10" : ""}`}>
                      <span className="text-white/30 text-xs w-4 flex-shrink-0">{i + 1}</span>
                      {t.cover_image_url ? (
                        <img src={t.cover_image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                          <Music className="w-3 h-3 text-white/30" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold truncate ${i === queueIndex ? "text-white" : "text-white/70"}`}>{t.track_title}</p>
                        <p className="text-xs text-white/30 truncate">{t.artist_name}</p>
                      </div>
                      <Badge className={`text-xs border flex-shrink-0 ${SOURCE_BADGE[t.source]?.cls || "bg-white/10 text-white/50"}`}>
                        {SOURCE_BADGE[t.source]?.label || t.source || "?"}
                      </Badge>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Channel Grid */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="text-xl font-bold text-foreground">All Channels</h2>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">Powered by Loudly + Community</p>
            <Button onClick={() => setShowBuilder(true)} size="sm" className="rounded-xl gap-2 bg-purple-600 hover:bg-purple-500 text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> Build Mix Playlist
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {channels.map((ch) => {
            const isActive = activeChannel.id === ch.id || activeChannel.slug === ch.slug;
            return (
              <motion.button key={ch.id || ch.slug} onClick={() => switchChannel(ch)}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="p-5 rounded-2xl border text-left transition-all"
                style={isActive ? activeStyle(ch) : channelStyle(ch)}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{ch.emoji || "🎵"}</span>
                  {isActive && (
                    <Badge className="text-xs border-0" style={{ background: ch.color_theme, color: "white" }}>
                      {isPlaying ? "▶ Live" : "Active"}
                    </Badge>
                  )}
                </div>
                <h3 className="font-bold text-foreground mb-1">{ch.name}</h3>
                <p className="text-xs text-muted-foreground">{ch.description}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      <audio ref={audioRef} onEnded={handleTrackEnd} onError={skipNext} />

      <AnimatePresence>
        {showBuilder && (
          <RadioPlaylistBuilder
            onClose={() => setShowBuilder(false)}
            onCreated={() => { setShowBuilder(false); toast.success("Radio playlist saved to Playlists!"); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}