import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX, Radio as RadioIcon, Wifi,
  SkipForward, SkipBack, Music, Loader2, ListMusic, RefreshCw, Plus, Upload
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import RadioPlaylistBuilder from "@/components/radio/RadioPlaylistBuilder";
import EQPanel from "@/components/radio/EQPanel";
import VUMeter from "@/components/radio/VUMeter";
import useAudioProcessor from "@/hooks/useAudioProcessor";

// Channel genres map to Audius trending genres + community submission genres
const DEFAULT_CHANNELS = [
  { id: "discover",   name: "Discover",         slug: "discover",  genre: null,              emoji: "🌟", color_theme: "#7C3AED", description: "Fresh tracks from Audius + the BASE Station community" },
  { id: "staffpicks", name: "Staff Picks",      slug: "staffpicks", genre: null,             emoji: "⭐", color_theme: "#FBBF24", description: "Hand-curated by the BASE Station team" },
  { id: "hiphop",     name: "Hip-Hop & Trap",   slug: "hiphop",    genre: "Hip Hop & Trap",  emoji: "🎤", color_theme: "#EF4444", description: "Beats, bars & trap bangers" },
  { id: "edm",        name: "EDM",               slug: "edm",       genre: "EDM",             emoji: "⚡", color_theme: "#06B6D4", description: "Synths, drops & electronic energy" },
  { id: "rb",         name: "Soul / R&B",        slug: "rb",        genre: "Soul/R&B",        emoji: "🎵", color_theme: "#EC4899", description: "Smooth R&B and neo-soul" },
  { id: "lofi",       name: "Lo-Fi",             slug: "lofi",      genre: "Lo-Fi",           emoji: "☕", color_theme: "#84CC16", description: "Chill beats to create and relax" },
  { id: "pop",        name: "Pop",               slug: "pop",       genre: "Pop",             emoji: "💫", color_theme: "#F59E0B", description: "Catchy pop from indie artists + creators" },
  { id: "house",      name: "House",             slug: "house",     genre: "House",           emoji: "🏠", color_theme: "#8B5CF6", description: "Deep & progressive house beats" },
  { id: "cinematic",  name: "Cinematic",         slug: "cinematic", genre: "Cinematic",       emoji: "🎬", color_theme: "#6366F1", description: "Cinematic scores & epic soundscapes" },
];

const SOURCE_BADGE = {
  audius:    { label: "Audius",    cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  community: { label: "Community", cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
};

export default function Radio() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [activeChannel, setActiveChannel] = useState(DEFAULT_CHANNELS[0]);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([45]);
  const [muted, setMuted] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showEQ, setShowEQ] = useState(false); // mobile-only collapse; desktop always shows
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const { setBandGain, analyserL, analyserR } = useAudioProcessor(audioRef);

  const nowPlaying = queue[queueIndex] || null;

  // Time tracking for progress bar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onMeta = () => setDuration(audio.duration || 0);
    const onLoadStart = () => { setCurrentTime(0); setDuration(0); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('loadstart', onLoadStart);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('loadstart', onLoadStart);
    };
  }, []);

  const handleSeek = (val) => {
    if (!audioRef.current || !duration) return;
    const t = (val[0] / 100) * duration;
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const fmtTime = (s) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

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
      const res = await base44.functions.invoke('radioQueue', {
        genre: ch.genre || undefined,
        limit: 15,
      });
      const q = res.data?.queue || [];
      setQueue(q);
      setLoadingQueue(false);
      if (q.length > 0) {
        // Pick a random starting track so each visit mixes Audius + community uploads
        const startIdx = Math.floor(Math.random() * q.length);
        setQueueIndex(startIdx);
        playTrack(q[startIdx]);
      } else {
        toast.info("No tracks available for this channel yet — try another channel or submit a track.");
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

  return (
    <div className="min-h-screen">
      {/* Hero / Player */}
      <div className="relative overflow-hidden pt-16 pb-8 px-4 md:px-6">
        <motion.div key={activeChannel.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-10 w-72 h-72 rounded-full blur-3xl opacity-15 bg-white" />
        </motion.div>

        <div className="relative max-w-5xl mx-auto">
          {/* Broadcast Console Hero — chrome nameplate */}
          <div className="mb-5 rounded-2xl overflow-hidden border border-white/10 bg-[#08080F] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_32px_-8px_rgba(0,0,0,0.8)]">
            {/* ON AIR strip */}
            <div className="relative px-4 sm:px-6 py-2 flex items-center justify-center gap-3 sm:gap-4 border-b border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
              <span className="text-white/70 text-[10px] sm:text-xs font-mono tracking-[0.3em] uppercase">On Air</span>
              <span className="relative flex items-center justify-center">
                <span className="absolute w-2.5 h-2.5 rounded-full bg-[#FF4D6D] animate-ping opacity-60" />
                <span className="relative w-2 h-2 rounded-full bg-[#FF4D6D] shadow-[0_0_8px_#FF4D6D]" />
              </span>
              <span className="text-white/70 text-[10px] sm:text-xs font-mono tracking-[0.3em] uppercase whitespace-nowrap">Base Station Radio</span>
              <Wifi className="w-3 h-3 text-emerald-400 hidden sm:inline" />
            </div>

            {/* Channel nameplate */}
            <motion.div
              key={activeChannel.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative px-4 sm:px-6 pt-5 pb-5 sm:pt-6 sm:pb-6"
            >
              <div className="flex items-center justify-center gap-3 sm:gap-5">
                <span className="text-3xl sm:text-5xl md:text-6xl leading-none flex-shrink-0">{activeChannel.emoji}</span>
                <h1 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl text-iridescent tracking-tight leading-none">
                  {activeChannel.name}
                </h1>
              </div>
              {/* Chrome reflection underline */}
              <div className="mt-3 sm:mt-4 mx-auto h-px max-w-[80%] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <p className="mt-3 text-center text-white/55 text-xs sm:text-sm md:text-base">
                {activeChannel.description}
              </p>
            </motion.div>
          </div>

          {/* Now Playing info */}
          <AnimatePresence mode="wait">
            {nowPlaying && (
              <motion.div key={nowPlaying.track_title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 mb-4">
                {nowPlaying.cover_image_url ? (
                  <img src={nowPlaying.cover_image_url} alt="" className="w-11 h-11 rounded-lg object-cover border border-white/20 flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Music className="w-5 h-5 text-white/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-white font-bold leading-tight truncate text-sm">{nowPlaying.track_title}</p>
                  <p className="text-white/50 text-xs truncate">{nowPlaying.artist_name}</p>
                </div>
                {nowPlaying.source && (
                  <Badge className={`hidden sm:inline-flex text-xs border flex-shrink-0 ${SOURCE_BADGE[nowPlaying.source]?.cls || ""}`}>
                    {SOURCE_BADGE[nowPlaying.source]?.label || nowPlaying.source}
                  </Badge>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Player Controls — mobile-first layout */}
          <TooltipProvider delayDuration={300}>
          <div className="merc-card p-4 rounded-2xl">
            {/* Top row: prev / play / next + status */}
            <div className="flex items-center gap-4 mb-3">
              {/* Prev */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={skipPrev} disabled={queue.length < 2}
                    aria-label="Previous track"
                    className="w-11 h-11 flex items-center justify-center rounded-full text-white/60 hover:text-white active:bg-white/10 transition-colors disabled:opacity-30">
                    <SkipBack className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Previous track</TooltipContent>
              </Tooltip>

              {/* Play/Pause */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={togglePlay} disabled={loadingQueue || queue.length === 0}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="merc-button w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 flex-shrink-0">
                    {loadingQueue ? <Loader2 className="w-6 h-6 animate-spin" /> : isPlaying ? <Pause className="w-6 h-6" fill="#0A0A12" /> : <Play className="w-6 h-6 ml-0.5" fill="#0A0A12" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{loadingQueue ? "Loading channel…" : isPlaying ? "Pause" : "Play"}</TooltipContent>
              </Tooltip>

              {/* Next */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={skipNext} disabled={queue.length < 2}
                    aria-label="Next track"
                    className="w-11 h-11 flex items-center justify-center rounded-full text-white/60 hover:text-white active:bg-white/10 transition-colors disabled:opacity-30">
                    <SkipForward className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Next track</TooltipContent>
              </Tooltip>

              {/* Status */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPlaying ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
                  <span className="text-white/70 text-sm font-medium">
                    {loadingQueue ? "Loading…" : isPlaying ? "Streaming" : nowPlaying ? "Paused" : "No tracks"}
                  </span>
                </div>
                {queue.length > 0 && (
                  <p className="text-white/40 text-xs mt-0.5">{queueIndex + 1} / {queue.length}</p>
                )}
              </div>

              {/* Queue toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setShowQueue(p => !p)}
                    aria-label="Toggle queue"
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${showQueue ? "bg-white/20 text-white" : "text-white/60 hover:text-white active:bg-white/10"}`}>
                    <ListMusic className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{showQueue ? "Hide queue" : "Show up next"}</TooltipContent>
              </Tooltip>

              {/* Reload — hidden on mobile (also available in queue panel header) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => loadQueue(activeChannel)}
                    aria-label="Reload channel"
                    className="hidden sm:flex w-10 h-10 items-center justify-center rounded-full text-white/40 hover:text-white active:bg-white/10 transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Reload channel — get fresh tracks</TooltipContent>
              </Tooltip>
            </div>

            {/* Progress / Scrubber */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono text-white/50 w-9 text-right tabular-nums">{fmtTime(currentTime)}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1">
                    <Slider
                      value={[duration ? (currentTime / duration) * 100 : 0]}
                      onValueChange={handleSeek}
                      max={100}
                      step={0.1}
                      disabled={!duration}
                      className="cursor-pointer"
                      aria-label="Track progress"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Drag to scrub through the track</TooltipContent>
              </Tooltip>
              <span className="text-[10px] font-mono text-white/50 w-9 tabular-nums">{fmtTime(duration)}</span>
            </div>

            {/* Bottom row: Volume */}
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setMuted(!muted)}
                    aria-label={muted ? "Unmute" : "Mute"}
                    className="w-10 h-10 flex items-center justify-center rounded-full text-white/60 hover:text-white active:bg-white/10 transition-colors flex-shrink-0">
                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{muted ? "Unmute" : "Mute"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1">
                    <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="cursor-pointer" aria-label="Volume" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Volume — {muted ? "muted" : `${volume[0]}%`}</TooltipContent>
              </Tooltip>
            </div>
          </div>
          </TooltipProvider>

          {/* VU Meters + EQ — mobile: L+R side-by-side, EQ collapsible | desktop: 3-col layout */}
          <div className="mt-3 md:hidden space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <VUMeter analyserRef={analyserL} label="L" isActive={isPlaying} />
              <VUMeter analyserRef={analyserR} label="R" isActive={isPlaying} />
            </div>
            <button onClick={() => setShowEQ(p => !p)}
              className="w-full merc-card rounded-2xl px-4 py-2.5 text-xs font-bold tracking-widest uppercase text-white/70 flex items-center justify-between active:bg-white/5">
              <span>5-Band EQ</span>
              <span className="text-white/40 text-[10px]">{showEQ ? 'Hide ▲' : 'Show ▼'}</span>
            </button>
            <AnimatePresence>
              {showEQ && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden">
                  <EQPanel setBandGain={setBandGain} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="hidden md:flex items-start justify-center gap-3 mt-3">
            <div className="w-56 flex-shrink-0">
              <VUMeter analyserRef={analyserL} label="L" isActive={isPlaying} />
            </div>
            <div className="w-72 flex-shrink-0">
              <EQPanel setBandGain={setBandGain} />
            </div>
            <div className="w-56 flex-shrink-0">
              <VUMeter analyserRef={analyserR} label="R" isActive={isPlaying} />
            </div>
          </div>

          {/* Queue Panel */}
          <AnimatePresence>
            {showQueue && queue.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="merc-card mt-3 rounded-2xl overflow-hidden">
                <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2">
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wider truncate">Up Next — {queue.length} tracks</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="hidden sm:flex gap-2 text-xs text-white/40">
                      <span>{queue.filter(t => t.source === 'audius').length} Audius</span>
                      <span>·</span>
                      <span>{queue.filter(t => t.source === 'community').length} Community</span>
                    </div>
                    {/* Mobile-only refresh control (hidden on desktop where the top-row reload is visible) */}
                    <button onClick={() => loadQueue(activeChannel)}
                      className="sm:hidden w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:text-white active:bg-white/10 transition-colors"
                      aria-label="Reload queue">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="max-h-72 sm:max-h-56 overflow-y-auto overscroll-contain">
                  {queue.map((t, i) => (
                    <button key={i} onClick={() => { setQueueIndex(i); playTrack(t); }}
                      className={`w-full flex items-center gap-3 px-3 py-3 text-left active:bg-white/10 transition-colors ${i === queueIndex ? "bg-white/10" : "hover:bg-white/5"}`}>
                      <span className="text-white/30 text-xs w-5 flex-shrink-0 text-center">{i + 1}</span>
                      {t.cover_image_url ? (
                        <img src={t.cover_image_url} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                          <Music className="w-3.5 h-3.5 text-white/30" />
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

      {/* Get on the Radio CTA */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6">
        <div className="merc-card p-4 md:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="merc-bubble w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0">
              <RadioIcon className="w-5 h-5 md:w-6 md:h-6 text-[#1a1530]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm md:text-base">Get your track on BASE Station Radio</p>
              <p className="text-white/60 text-xs md:text-sm">Upload a track you made — anywhere — and we'll mix it in with Audius hits across our channels.</p>
            </div>
          </div>
          <Link to="/submit" className="w-full sm:w-auto flex-shrink-0">
            <button className="merc-button rounded-full w-full sm:w-auto px-4 h-9 text-xs font-bold inline-flex items-center justify-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload Track
            </button>
          </Link>
        </div>
      </div>

      {/* Channel Grid — horizontal scroll on mobile */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-5 gap-3">
          <h2 className="font-display text-lg md:text-2xl text-white">All Channels</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <p className="text-xs text-white/50 hidden sm:block">Powered by Audius + Community</p>
            <button onClick={() => setShowBuilder(true)} className="merc-button-dark rounded-full px-3 h-9 text-xs font-bold inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Build Mix
            </button>
          </div>
        </div>
        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4 md:gap-4 scrollbar-hide">
          {channels.map((ch) => {
            const isActive = activeChannel.id === ch.id || activeChannel.slug === ch.slug;
            return (
              <motion.button key={ch.id || ch.slug} onClick={() => switchChannel(ch)}
                whileTap={{ scale: 0.97 }}
                className={`merc-card merc-card-hover snap-start flex-shrink-0 w-44 md:w-auto p-4 md:p-5 rounded-2xl text-left transition-all ${isActive ? "ring-1 ring-white/30" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl md:text-3xl">{ch.emoji || "🎵"}</span>
                  {isActive && (
                    <Badge className="text-xs border-0 bg-white/15 text-white">
                      {isPlaying ? "▶" : "•"}
                    </Badge>
                  )}
                </div>
                <h3 className="font-bold text-white text-sm mb-1 leading-tight">{ch.name}</h3>
                <p className="text-xs text-white/50 line-clamp-2 hidden md:block">{ch.description}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      <audio ref={audioRef} onEnded={handleTrackEnd} onError={skipNext} crossOrigin="anonymous" />

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