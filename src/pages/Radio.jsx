import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX, Radio as RadioIcon,
  SkipForward, SkipBack, Music, Loader2, ListMusic, RefreshCw, Plus, Upload
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import RadioPlaylistBuilder from "@/components/radio/RadioPlaylistBuilder";
import EQPanel from "@/components/radio/EQPanel";
import VUMeter from "@/components/radio/VUMeter";
import RackUnit from "@/components/radio/RackUnit";
import ChannelSelector from "@/components/radio/ChannelSelector";
import TransportKnob from "@/components/radio/TransportKnob";
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

// Green phosphor dot-matrix screen styling
const SCREEN_BG = {
  backgroundColor: "#0C120A",
  backgroundImage: "radial-gradient(rgba(0,0,0,0.55) 1px, transparent 1px)",
  backgroundSize: "4px 4px",
};
const GREEN_GLOW = { textShadow: "0 0 8px rgba(198,242,126,0.55)" };
const MONO_LCD = { fontFamily: "'VT323', monospace" };

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
    <div className="min-h-screen pt-16 pb-12 px-2 sm:px-4">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ═══════════ DISPLAY UNIT (1U) ═══════════ */}
        <RackUnit title="Display Unit (1U)">
          {/* Dot-matrix phosphor screen */}
          <motion.div key={activeChannel.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl border-2 border-black/80 p-4 sm:p-6 shadow-[inset_0_4px_24px_rgba(0,0,0,0.9),0_0_20px_rgba(198,242,126,0.06)]"
            style={SCREEN_BG}>
            {/* Screen header row */}
            <div className="flex items-center justify-between text-[#C6F27E]/80 text-lg sm:text-2xl tracking-[0.2em] uppercase mb-3 sm:mb-4"
              style={{ ...MONO_LCD, ...GREEN_GLOW }}>
              <span>Track</span><span className="text-[#FF9A4D]">▸</span>
              <span>Artist</span><span className="text-[#FF9A4D]">▸</span>
              <span>Freq</span>
            </div>
            <div className="h-px bg-[#C6F27E]/20 mb-4" />
            {/* Channel name */}
            <div className="flex items-center justify-center gap-3 sm:gap-5">
              <span className="text-4xl sm:text-6xl leading-none flex-shrink-0 drop-shadow-[0_0_10px_rgba(255,179,71,0.5)]">{activeChannel.emoji}</span>
              <h1 className="text-5xl sm:text-7xl md:text-8xl text-[#C6F27E] leading-none tracking-tight"
                style={{ ...MONO_LCD, textShadow: "0 0 16px rgba(198,242,126,0.6), 0 0 40px rgba(198,242,126,0.25)" }}>
                {activeChannel.name}
              </h1>
            </div>
            <p className="mt-3 sm:mt-4 text-center text-[#E4FCA8]/90 text-sm sm:text-lg" style={{ ...MONO_LCD, ...GREEN_GLOW }}>
              {activeChannel.description}
            </p>
          </motion.div>

          {/* Now Playing readout + ON AIR lamp */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="rounded-lg border border-black/80 px-4 py-3 min-h-[64px] flex items-center gap-3 shadow-[inset_0_2px_12px_rgba(0,0,0,0.85)]" style={SCREEN_BG}>
              <AnimatePresence mode="wait">
                {nowPlaying ? (
                  <motion.div key={nowPlaying.track_title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 min-w-0 flex-1">
                    {nowPlaying.cover_image_url ? (
                      <img src={nowPlaying.cover_image_url} alt="" className="w-10 h-10 rounded object-cover border border-[#C6F27E]/30 flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-black/50 border border-[#C6F27E]/20 flex items-center justify-center flex-shrink-0">
                        <Music className="w-4 h-4 text-[#C6F27E]/40" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[#C6F27E] text-base sm:text-xl leading-tight truncate" style={{ ...MONO_LCD, ...GREEN_GLOW }}>{nowPlaying.track_title}</p>
                      <p className="text-[#A8C97E]/80 text-sm sm:text-base truncate" style={MONO_LCD}>{nowPlaying.artist_name}</p>
                    </div>
                    {nowPlaying.source && (
                      <Badge className={`hidden sm:inline-flex text-xs border flex-shrink-0 ${SOURCE_BADGE[nowPlaying.source]?.cls || ""}`}>
                        {SOURCE_BADGE[nowPlaying.source]?.label || nowPlaying.source}
                      </Badge>
                    )}
                  </motion.div>
                ) : (
                  <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-[#A8C97E]/50 text-base" style={MONO_LCD}>
                    {loadingQueue ? "SCANNING FREQUENCIES…" : "NO SIGNAL"}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="rounded-lg border border-black/80 bg-gradient-to-b from-[#1C1712] to-[#0E0B08] px-5 py-3 flex flex-col items-center justify-center gap-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-2">
                <span className="relative flex items-center justify-center">
                  {isPlaying && <span className="absolute w-3 h-3 rounded-full bg-[#FF4D6D] animate-ping opacity-60" />}
                  <span className={`relative w-2.5 h-2.5 rounded-full ${isPlaying ? "bg-[#FF4D6D] shadow-[0_0_10px_#FF4D6D]" : "bg-[#5A2230]"}`} />
                </span>
                <span className={`text-xs font-mono font-bold tracking-widest ${isPlaying ? "text-[#FF8095]" : "text-white/40"}`}>ON AIR</span>
                <span className="w-2 h-2 rounded-full bg-white/15" />
              </div>
              <span className="text-white/70 text-[11px] font-mono tracking-[0.2em] uppercase whitespace-nowrap">Base Station Radio</span>
            </div>
          </div>
        </RackUnit>

        {/* ═══════════ TRANSPORT UNIT (2U) ═══════════ */}
        <RackUnit title="Transport Unit (2U)" badge="BASE Station" badgeColor="amber">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 lg:pl-6">

            {/* Channel selector */}
            <ChannelSelector
              channels={channels}
              activeChannel={activeChannel}
              isPlaying={isPlaying}
              onSelect={switchChannel}
            />

            {/* Transport controls */}
            <div className="space-y-4">
              {/* Knob row */}
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-start gap-5 sm:gap-7">
                  <TransportKnob
                    icon={loadingQueue ? Loader2 : isPlaying ? Pause : Play}
                    spinning={loadingQueue}
                    label="Play/Pause" primary
                    onClick={togglePlay}
                    disabled={loadingQueue || queue.length === 0} />
                  <TransportKnob icon={SkipForward} label="Next" onClick={skipNext} disabled={queue.length < 2} />
                  <TransportKnob icon={SkipBack} label="Previous" onClick={skipPrev} disabled={queue.length < 2} />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button onClick={() => setShowQueue(p => !p)} aria-label="Toggle queue"
                    className={`rounded-full px-4 py-1.5 border transition-colors flex items-center gap-2
                      ${showQueue ? "bg-[#1B2410] border-[#C6F27E]/50 text-[#C6F27E]" : "bg-[#1C1712] border-white/10 text-white/50 hover:text-white/80"}`}>
                    <ListMusic className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold tracking-wider uppercase">Queue</span>
                  </button>
                  <button onClick={() => loadQueue(activeChannel)} aria-label="Reload channel"
                    className="rounded-full px-4 py-1.5 border bg-[#1C1712] border-white/10 text-white/50 hover:text-white/80 transition-colors flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold tracking-wider uppercase">Reload</span>
                  </button>
                </div>
              </div>

              {/* Timecode LCD */}
              <div className="rounded-lg border-2 border-black/80 px-4 py-2 flex items-center justify-between shadow-[inset_0_3px_16px_rgba(0,0,0,0.9)]" style={SCREEN_BG}>
                <span className="text-3xl sm:text-4xl text-[#C6F27E]" style={{ ...MONO_LCD, ...GREEN_GLOW }}>
                  {fmtTime(currentTime)}<span className="animate-pulse">|</span>
                </span>
                <span className="text-3xl sm:text-4xl text-[#C6F27E]/80" style={{ ...MONO_LCD, ...GREEN_GLOW }}>
                  {fmtTime(duration)}
                </span>
              </div>

              {/* Status + scrubber strip */}
              <div className="rounded-lg border border-black/70 bg-[#0F0C09] px-4 py-3 space-y-2.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)]">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPlaying ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" : "bg-white/30"}`} />
                  <span className="text-white/70 text-sm font-medium flex-1">
                    {loadingQueue ? "Loading…" : isPlaying ? "Streaming" : nowPlaying ? "Paused" : "No tracks"}
                  </span>
                  {nowPlaying?.source && (
                    <Badge className={`text-xs border flex-shrink-0 ${SOURCE_BADGE[nowPlaying.source]?.cls || ""}`}>
                      {SOURCE_BADGE[nowPlaying.source]?.label || nowPlaying.source}
                    </Badge>
                  )}
                </div>
                <Slider
                  value={[duration ? (currentTime / duration) * 100 : 0]}
                  onValueChange={handleSeek}
                  max={100} step={0.1} disabled={!duration}
                  className="cursor-pointer" aria-label="Track progress" />
                <div className="flex items-center justify-between text-[11px] font-mono text-white/40 tabular-nums">
                  <span>{fmtTime(currentTime)}</span>
                  {queue.length > 0 && <span>{queueIndex + 1} / {queue.length}</span>}
                  <span>{fmtTime(duration)}</span>
                </div>
              </div>

              {/* Volume */}
              <div className="relative pt-2">
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider uppercase text-white/60 bg-[#1C1712] border border-white/10 rounded-full px-3 py-0.5">Volume</span>
                <div className="flex items-center gap-3 rounded-lg border border-black/70 bg-[#0F0C09] px-4 py-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)]">
                  <button onClick={() => setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white active:bg-white/10 transition-colors flex-shrink-0">
                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="cursor-pointer flex-1" aria-label="Volume" />
                </div>
              </div>
            </div>
          </div>

          {/* Queue Panel */}
          <AnimatePresence>
            {showQueue && queue.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-4 rounded-lg border border-black/70 overflow-hidden" style={SCREEN_BG}>
                <div className="p-3 border-b border-[#C6F27E]/15 flex items-center justify-between gap-2">
                  <p className="text-[#C6F27E]/80 text-xs font-mono font-semibold uppercase tracking-wider truncate">Up Next — {queue.length} tracks</p>
                  <div className="hidden sm:flex gap-2 text-xs text-[#A8C97E]/50 font-mono">
                    <span>{queue.filter(t => t.source === 'audius').length} Audius</span>
                    <span>·</span>
                    <span>{queue.filter(t => t.source === 'community').length} Community</span>
                  </div>
                </div>
                <div className="max-h-72 sm:max-h-56 overflow-y-auto overscroll-contain">
                  {queue.map((t, i) => (
                    <button key={i} onClick={() => { setQueueIndex(i); playTrack(t); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${i === queueIndex ? "bg-[#C6F27E]/10" : "hover:bg-[#C6F27E]/5 active:bg-[#C6F27E]/10"}`}>
                      <span className="text-[#A8C97E]/40 text-xs font-mono w-5 flex-shrink-0 text-center">{i + 1}</span>
                      {t.cover_image_url ? (
                        <img src={t.cover_image_url} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-black/40 flex items-center justify-center flex-shrink-0">
                          <Music className="w-3.5 h-3.5 text-[#C6F27E]/30" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold truncate ${i === queueIndex ? "text-[#E4FCA8]" : "text-[#A8C97E]"}`}>{t.track_title}</p>
                        <p className="text-xs text-[#A8C97E]/40 truncate">{t.artist_name}</p>
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
        </RackUnit>

        {/* ═══════════ METER UNIT (1U) ═══════════ */}
        <RackUnit title="Meter Unit (1U)" badge="COMMS" badgeColor="green">
          {/* Mobile: VU pair + collapsible EQ */}
          <div className="md:hidden space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <VUMeter analyserRef={analyserL} label="L" isActive={isPlaying} />
                <p className="text-center text-white/70 text-xs font-semibold">Left</p>
              </div>
              <div className="space-y-1.5">
                <VUMeter analyserRef={analyserR} label="R" isActive={isPlaying} />
                <p className="text-center text-white/70 text-xs font-semibold">Right</p>
              </div>
            </div>
            <button onClick={() => setShowEQ(p => !p)}
              className="w-full rounded-lg border border-white/10 bg-[#1C1712] px-4 py-2.5 text-xs font-bold tracking-widest uppercase text-white/70 flex items-center justify-between active:bg-white/5">
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

          {/* Desktop: VU L / VU R / EQ */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_1.2fr] gap-4 items-start">
            <div className="space-y-2">
              <VUMeter analyserRef={analyserL} label="L" isActive={isPlaying} />
              <p className="text-center text-white/70 text-sm font-semibold">Left</p>
            </div>
            <div className="space-y-2">
              <VUMeter analyserRef={analyserR} label="R" isActive={isPlaying} />
              <p className="text-center text-white/70 text-sm font-semibold">Right</p>
            </div>
            <EQPanel setBandGain={setBandGain} />
          </div>

          {/* Brushed metal CTA strip */}
          <div className="mt-5 rounded-lg border border-black/60 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
            style={{ background: "linear-gradient(180deg, #C9CDD1 0%, #A8ACB0 30%, #8E9296 55%, #B4B8BC 80%, #D4D8DC 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 border border-black/50" style={SCREEN_BG}>
                <RadioIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#C6F27E]" style={{ filter: "drop-shadow(0 0 4px rgba(198,242,126,0.6))" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#14100C] font-black text-sm sm:text-base">Get your track on BASE Station Radio</p>
                <p className="text-[#3A342E] text-xs sm:text-sm">Upload a track you made — anywhere — and we'll mix it in with Audius hits across our channels.</p>
              </div>
            </div>
            <Link to="/submit" className="w-full sm:w-auto flex-shrink-0">
              <button className="w-full sm:w-auto rounded-full px-5 h-10 text-xs font-black inline-flex items-center justify-center gap-1.5 text-[#14100C] transition-transform active:scale-95"
                style={{ background: "linear-gradient(135deg, #FFC26E 0%, #FF9A4D 50%, #FF6B4A 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 12px rgba(255,140,60,0.5)" }}>
                <Upload className="w-3.5 h-3.5" /> Upload Track
              </button>
            </Link>
          </div>

          {/* All Channels */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="font-display text-xl md:text-2xl text-white">All Channels</h2>
              <div className="flex items-center gap-3 flex-shrink-0">
                <p className="text-xs text-white/50 hidden sm:block">Powered by Audius + Community</p>
                <button onClick={() => setShowBuilder(true)} className="merc-button-dark rounded-full px-4 h-9 text-xs font-bold inline-flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Build Mix
                </button>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4 md:gap-3 scrollbar-hide">
              {channels.map((ch) => {
                const isActive = activeChannel.id === ch.id || activeChannel.slug === ch.slug;
                return (
                  <motion.button key={ch.id || ch.slug} onClick={() => switchChannel(ch)}
                    whileTap={{ scale: 0.97 }}
                    className={`snap-start flex-shrink-0 w-44 md:w-auto p-4 rounded-lg text-left transition-all border
                      ${isActive
                        ? "bg-[#1B2410] border-[#FF9A4D]/60 shadow-[0_0_12px_rgba(255,154,77,0.2)]"
                        : "bg-[#131A0C] border-[#C6F27E]/15 hover:border-[#C6F27E]/40"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{ch.emoji || "🎵"}</span>
                      {isActive && (
                        <Badge className="text-xs border-0 bg-[#C6F27E]/20 text-[#C6F27E]">
                          {isPlaying ? "▶" : "•"}
                        </Badge>
                      )}
                    </div>
                    <h3 className={`font-bold text-sm mb-1 leading-tight ${isActive ? "text-[#E4FCA8]" : "text-[#A8C97E]"}`}>{ch.name}</h3>
                    <p className="text-xs text-white/40 line-clamp-2 hidden md:block">{ch.description}</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </RackUnit>
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