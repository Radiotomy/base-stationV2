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
import RoundVUGauge from "@/components/radio/RoundVUGauge";
import ChannelChipRow from "@/components/radio/ChannelChipRow";
import AccordionBar from "@/components/radio/AccordionBar";
import TransportKnob from "@/components/radio/TransportKnob";
import RadioTip from "@/components/radio/RadioTip";
import useAudioProcessor from "@/hooks/useAudioProcessor";
import AILabelBadge from "@/components/common/AILabelBadge";

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

// Boombox chassis screw
function Screw() {
  return (
    <span className="relative inline-block w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#3A322A] to-[#0E0B08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] flex-shrink-0">
      <span className="absolute inset-0 flex items-center justify-center text-[6px] text-black/70 leading-none">✕</span>
    </span>
  );
}

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
  const [showEQ, setShowEQ] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);      // CORS-enabled element wired to EQ + VU meters
  const fallbackRef = useRef(null);   // plain element for CORS-blocked streams (Audius CDN etc.)
  const activeElRef = useRef(null);
  const playSeqRef = useRef(0);
  const loadSeqRef = useRef(0);      // discard stale/duplicate queue loads (e.g. double mount)
  const userNavigatedRef = useRef(false); // only autoplay after a real user action
  const [eqActive, setEqActive] = useState(true);
  const { setBandGain, analyserL, analyserR } = useAudioProcessor(audioRef);

  // Quick CORS probe — if the stream host allows CORS we can route it
  // through the Web Audio EQ/VU chain; otherwise play it directly.
  const probeCors = async (url) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { mode: 'cors', signal: controller.signal });
      clearTimeout(timer);
      try { controller.abort(); } catch { /* stop body download */ }
      return res.ok;
    } catch {
      return false;
    }
  };

  const nowPlaying = queue[queueIndex] || null;

  // Time tracking for progress bar — listen on both elements, respond only to the active one
  useEffect(() => {
    const els = [audioRef.current, fallbackRef.current].filter(Boolean);
    const onTime = (e) => { if (e.target === activeElRef.current) setCurrentTime(e.target.currentTime || 0); };
    const onMeta = (e) => { if (e.target === activeElRef.current) setDuration(e.target.duration || 0); };
    const onLoadStart = (e) => { if (e.target === activeElRef.current) { setCurrentTime(0); setDuration(0); } };
    els.forEach(a => {
      a.addEventListener('timeupdate', onTime);
      a.addEventListener('loadedmetadata', onMeta);
      a.addEventListener('durationchange', onMeta);
      a.addEventListener('loadstart', onLoadStart);
    });
    return () => els.forEach(a => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('loadstart', onLoadStart);
    });
  }, []);

  const handleSeek = (val) => {
    const el = activeElRef.current;
    if (!el || !duration) return;
    const t = (val[0] / 100) * duration;
    el.currentTime = t;
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

  // Volume / mute sync — apply to both playback elements
  useEffect(() => {
    [audioRef.current, fallbackRef.current].forEach(el => {
      if (el) el.volume = muted ? 0 : volume[0] / 100;
    });
  }, [volume, muted]);

  // Load queue when channel changes
  const loadQueue = useCallback(async (ch, { autoplay = true } = {}) => {
    const loadSeq = ++loadSeqRef.current;
    setLoadingQueue(true);
    setQueue([]);
    setQueueIndex(0);
    setIsPlaying(false);
    playSeqRef.current++;
    [audioRef.current, fallbackRef.current].forEach(el => {
      if (el) { el.pause(); el.removeAttribute('src'); }
    });

    try {
      const res = await base44.functions.invoke('radioQueue', {
        genre: ch.genre || undefined,
        limit: 15,
      });
      if (loadSeq !== loadSeqRef.current) return; // a newer load superseded this one
      const q = res.data?.queue || [];
      setQueue(q);
      setLoadingQueue(false);
      if (q.length > 0) {
        // Pick a random starting track so each visit mixes Audius + community uploads
        const startIdx = Math.floor(Math.random() * q.length);
        setQueueIndex(startIdx);
        if (autoplay) playTrack(q[startIdx]);
      } else {
        toast.info("No tracks available for this channel yet — try another channel or submit a track.");
      }
    } catch (e) {
      if (loadSeq !== loadSeqRef.current) return;
      setLoadingQueue(false);
      toast.error("Couldn't load channel: " + e.message);
    }
  }, []);

  useEffect(() => {
    // No autoplay on initial page load — playback starts on the user's first action
    loadQueue(activeChannel, { autoplay: userNavigatedRef.current });
  }, [activeChannel]);

  const proxiedUrlsRef = useRef({}); // original audio_url -> CORS-friendly proxied copy

  const playTrack = async (track) => {
    if (!track?.audio_url) return;
    const seq = ++playSeqRef.current;
    let url = track.audio_url;
    let useEQ = await probeCors(url);
    if (seq !== playSeqRef.current) return; // user skipped while probing
    // Community / generated tracks on CORS-blocked hosts: pull a copy through
    // our audio proxy so the EQ + real VU analysis chain works for them too.
    // Audius catalog tracks stay direct-streamed from their CDN.
    if (!useEQ && track.source !== 'audius') {
      const cached = proxiedUrlsRef.current[track.audio_url];
      if (cached) {
        url = cached;
        useEQ = true;
      } else {
        try {
          const res = await base44.functions.invoke('proxyAudioAsset', {
            source_url: track.audio_url,
            filename: `${(track.track_title || 'track').replace(/[^\w\- ]/g, '')}.mp3`,
          });
          if (seq !== playSeqRef.current) return;
          if (res.data?.file_url) {
            proxiedUrlsRef.current[track.audio_url] = res.data.file_url;
            url = res.data.file_url;
            useEQ = true;
          }
        } catch {
          // proxy unavailable — fall back to direct playback without EQ
          if (seq !== playSeqRef.current) return;
        }
      }
    }
    const el = useEQ ? audioRef.current : fallbackRef.current;
    const other = useEQ ? fallbackRef.current : audioRef.current;
    if (!el) return;
    if (other) { other.pause(); other.removeAttribute('src'); }
    activeElRef.current = el;
    setEqActive(useEQ);
    el.src = url;
    el.play().catch(() => setIsPlaying(false));
    setIsPlaying(true);
  };

  const togglePlay = () => {
    const el = activeElRef.current;
    if (isPlaying) {
      el?.pause();
      setIsPlaying(false);
    } else if (el?.getAttribute('src')) {
      el.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    } else if (nowPlaying?.audio_url) {
      playTrack(nowPlaying);
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

  // Skip broken tracks — but ignore error events from the idle element or a cleared src
  const handleAudioError = (e) => {
    if (e.target !== activeElRef.current || !e.target.getAttribute('src')) return;
    skipNext();
  };

  const switchChannel = (ch) => {
    userNavigatedRef.current = true;
    setActiveChannel(ch);
  };

  return (
    <div className="min-h-screen pt-16 pb-12 px-2 sm:px-4">
      <div className="max-w-5xl mx-auto space-y-3">

        {/* ═══════════ BOOMBOX FACEPLATE ═══════════ */}
        <div className="relative rounded-xl border border-black/80 bg-gradient-to-b from-[#221B14] via-[#191410] to-[#14100C] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
          {/* Brushed silver metal top edge */}
          <div className="h-3 w-full flex items-center justify-between px-3"
            style={{ background: "linear-gradient(180deg, #D4D8DC 0%, #A8ACB0 45%, #8E9296 75%, #B4B8BC 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.4)" }} />

          <div className="p-3 sm:p-4">
            {/* Corner screws + unit label */}
            <div className="flex items-center gap-3 mb-3">
              <Screw />
              <span className="h-px flex-none w-4 bg-[#FF9A4D]/50" />
              <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#D9CBB8] whitespace-nowrap">BASE Station Radio</span>
              <span className="h-px flex-1 bg-[#FF9A4D]/50" />
              <span className="text-xs font-black text-[#FF9A4D] tracking-wide whitespace-nowrap hidden sm:inline">BASE Station</span>
              <Screw />
            </div>

            {/* Faceplate: LCD | transport | VU gauges */}
            <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_auto_auto] gap-3 md:gap-5 items-stretch">

              {/* LEFT — square phosphor LCD */}
              <motion.div key={activeChannel.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-lg border-2 border-black/80 p-3 shadow-[inset_0_4px_24px_rgba(0,0,0,0.9),0_0_20px_rgba(198,242,126,0.06)] flex flex-col justify-between min-h-[120px]"
                style={SCREEN_BG}>
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none drop-shadow-[0_0_8px_rgba(255,179,71,0.5)]">{activeChannel.emoji}</span>
                  <span className="text-2xl sm:text-3xl text-[#C6F27E] leading-none tracking-tight truncate"
                    style={{ ...MONO_LCD, textShadow: "0 0 14px rgba(198,242,126,0.6)" }}>
                    {activeChannel.name}
                  </span>
                </div>
                <AnimatePresence mode="wait">
                  {nowPlaying ? (
                    <motion.div key={nowPlaying.track_title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2.5 min-w-0 mt-2">
                      {nowPlaying.cover_image_url ? (
                        <img src={nowPlaying.cover_image_url} alt="" className="w-9 h-9 rounded object-cover border border-[#C6F27E]/30 flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-black/50 border border-[#C6F27E]/20 flex items-center justify-center flex-shrink-0">
                          <Music className="w-4 h-4 text-[#C6F27E]/40" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[#C6F27E] text-base sm:text-lg leading-tight truncate" style={{ ...MONO_LCD, ...GREEN_GLOW }}>{nowPlaying.track_title}</p>
                        <p className="text-[#A8C97E]/80 text-sm truncate" style={MONO_LCD}>{nowPlaying.artist_name}</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="text-[#A8C97E]/50 text-base mt-2" style={MONO_LCD}>
                      {loadingQueue ? "SCANNING FREQUENCIES…" : "NO SIGNAL"}
                    </motion.p>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {nowPlaying && <AILabelBadge label={nowPlaying.ai_label} size="xs" className="flex-shrink-0" />}
                  {nowPlaying?.source && (
                    <Badge className={`text-[10px] border flex-shrink-0 ${SOURCE_BADGE[nowPlaying.source]?.cls || ""}`}>
                      {SOURCE_BADGE[nowPlaying.source]?.label || nowPlaying.source}
                    </Badge>
                  )}
                  {queue.length > 0 && (
                    <span className="text-[#A8C97E]/50 text-xs ml-auto font-mono tabular-nums">{queueIndex + 1}/{queue.length}</span>
                  )}
                </div>
              </motion.div>

              {/* CENTER — transport knobs + timecode + scrubber */}
              <div className="flex flex-col items-center justify-between gap-2.5 min-w-[240px]">
                <div className="flex items-center gap-4 sm:gap-5">
                  <TransportKnob icon={SkipBack} label="Prev" tip="Go back to the previous track" onClick={skipPrev} disabled={queue.length < 2} />
                  <TransportKnob
                    icon={loadingQueue ? Loader2 : isPlaying ? Pause : Play}
                    spinning={loadingQueue}
                    label="Play/Pause" primary
                    tip={loadingQueue ? "Tuning in…" : isPlaying ? "Pause the radio" : "Start playing this channel"}
                    onClick={togglePlay}
                    disabled={loadingQueue || queue.length === 0} />
                  <TransportKnob icon={SkipForward} label="Next" tip="Skip to the next track in the queue" onClick={skipNext} disabled={queue.length < 2} />
                </div>
                <div className="w-full rounded-md border border-black/80 px-3 py-1 flex items-center justify-center gap-2 shadow-[inset_0_3px_16px_rgba(0,0,0,0.9)]" style={SCREEN_BG}>
                  <span className="text-xl text-[#C6F27E]" style={{ ...MONO_LCD, ...GREEN_GLOW }}>{fmtTime(currentTime)}</span>
                  <span className="text-xl text-[#C6F27E]/50" style={MONO_LCD}>|</span>
                  <span className="text-xl text-[#C6F27E]/80" style={{ ...MONO_LCD, ...GREEN_GLOW }}>{fmtTime(duration)}</span>
                </div>
                <RadioTip tip="Seek — drag to jump to any point in the track">
                  <span className="w-full block">
                    <Slider
                      value={[duration ? (currentTime / duration) * 100 : 0]}
                      onValueChange={handleSeek}
                      max={100} step={0.1} disabled={!duration}
                      className="cursor-pointer w-full" aria-label="Track progress" />
                  </span>
                </RadioTip>
                <div className="w-full flex items-center gap-2">
                  <RadioTip tip={muted ? "Unmute the radio" : "Mute the radio"}>
                    <button onClick={() => setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white active:bg-white/10 transition-colors flex-shrink-0">
                      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </RadioTip>
                  <RadioTip tip="Volume — drag to adjust loudness">
                    <span className="flex-1 block">
                      <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="cursor-pointer w-full" aria-label="Volume" />
                    </span>
                  </RadioTip>
                  <RadioTip tip={showQueue ? "Hide the Up Next queue" : "Show the Up Next queue"}>
                    <button onClick={() => setShowQueue(p => !p)} aria-label="Toggle queue"
                      className={`rounded-full p-2 border transition-colors flex-shrink-0
                        ${showQueue ? "bg-[#1B2410] border-[#C6F27E]/50 text-[#C6F27E]" : "bg-[#1C1712] border-white/10 text-white/50 hover:text-white/80"}`}>
                      <ListMusic className="w-3.5 h-3.5" />
                    </button>
                  </RadioTip>
                  <RadioTip tip="Rescan — load a fresh mix for this channel">
                    <button onClick={() => loadQueue(activeChannel)} aria-label="Reload channel"
                      className="rounded-full p-2 border bg-[#1C1712] border-white/10 text-white/50 hover:text-white/80 transition-colors flex-shrink-0">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </RadioTip>
                </div>
              </div>

              {/* RIGHT — twin round analog VU gauges */}
              <div className="flex md:flex-col lg:flex-row items-center justify-center gap-3 md:gap-2 lg:gap-3">
                <RadioTip tip={eqActive ? "Left channel VU meter — live audio level" : "Left channel VU meter"}>
                  <span><RoundVUGauge analyserRef={analyserL} label="L" isActive={isPlaying && eqActive} simulate={isPlaying && !eqActive} /></span>
                </RadioTip>
                <RadioTip tip={eqActive ? "Right channel VU meter — live audio level" : "Right channel VU meter"}>
                  <span><RoundVUGauge analyserRef={analyserR} label="R" isActive={isPlaying && eqActive} simulate={isPlaying && !eqActive} /></span>
                </RadioTip>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ CHANNEL PRESET CHIP ROW ═══════════ */}
        <ChannelChipRow
          channels={channels}
          activeChannel={activeChannel}
          isPlaying={isPlaying}
          onSelect={switchChannel}
        />

        {/* Queue Panel */}
        <AnimatePresence>
          {showQueue && queue.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="rounded-lg border border-black/70 overflow-hidden" style={SCREEN_BG}>
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
                    title={`Play "${t.track_title}" by ${t.artist_name}`}
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
                    <AILabelBadge label={t.ai_label} size="xs" className="flex-shrink-0" />
                    <Badge className={`text-xs border flex-shrink-0 ${SOURCE_BADGE[t.source]?.cls || "bg-white/10 text-white/50"}`}>
                      {SOURCE_BADGE[t.source]?.label || t.source || "?"}
                    </Badge>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════ 5-BAND EQ ACCORDION ═══════════ */}
        <AccordionBar title="5-Band EQ" tip="Open the 5-band equalizer to shape the sound" open={showEQ} onToggle={() => setShowEQ(p => !p)}
          right={<span className="text-[10px] font-mono text-[#C6F27E]/60 hidden sm:inline">60 · 250 · 1k · 4k · 12k</span>}>
          <EQPanel setBandGain={setBandGain} />
        </AccordionBar>

        {/* ═══════════ ALL CHANNELS ACCORDION ═══════════ */}
        <AccordionBar title="All Channels" tip="Browse every radio channel with full descriptions" open={showChannels} onToggle={() => setShowChannels(p => !p)}
          right={<span className="text-[10px] font-mono text-white/40 hidden sm:inline">Audius + Community</span>}>
          <div className="flex justify-end mb-3">
            <RadioTip tip="Build a custom radio mix and save it as a playlist">
              <button onClick={() => setShowBuilder(true)} className="merc-button-dark rounded-full px-4 h-8 text-xs font-bold inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Build Mix
              </button>
            </RadioTip>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {channels.map((ch) => {
              const isActive = activeChannel.id === ch.id || activeChannel.slug === ch.slug;
              return (
                <motion.button key={ch.id || ch.slug} onClick={() => switchChannel(ch)}
                  title={isActive ? `Tuned to ${ch.name}` : `Tune to ${ch.name}${ch.description ? ` — ${ch.description}` : ""}`}
                  whileTap={{ scale: 0.97 }}
                  className={`p-3 rounded-lg text-left transition-all border
                    ${isActive
                      ? "bg-[#1B2410] border-[#FF9A4D]/60 shadow-[0_0_12px_rgba(255,154,77,0.2)]"
                      : "bg-[#131A0C] border-[#C6F27E]/15 hover:border-[#C6F27E]/40"}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xl">{ch.emoji || "🎵"}</span>
                    {isActive && (
                      <Badge className="text-xs border-0 bg-[#C6F27E]/20 text-[#C6F27E]">
                        {isPlaying ? "▶" : "•"}
                      </Badge>
                    )}
                  </div>
                  <h3 className={`font-bold text-sm mb-0.5 leading-tight ${isActive ? "text-[#E4FCA8]" : "text-[#A8C97E]"}`}>{ch.name}</h3>
                  <p className="text-xs text-white/40 line-clamp-2 hidden md:block">{ch.description}</p>
                </motion.button>
              );
            })}
          </div>
        </AccordionBar>

        {/* ═══════════ BRUSHED METAL CTA STRIP + ON AIR ═══════════ */}
        <div className="rounded-lg border border-black/60 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
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
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* ON AIR lamp */}
            <div className="flex items-center gap-2 rounded-full border border-black/40 bg-[#14100C] px-3 py-1.5"
              title={isPlaying ? "ON AIR — the radio is broadcasting" : "Off air — press play to start broadcasting"}>
              <span className="relative flex items-center justify-center">
                {isPlaying && <span className="absolute w-3 h-3 rounded-full bg-[#FF4D6D] animate-ping opacity-60" />}
                <span className={`relative w-2.5 h-2.5 rounded-full ${isPlaying ? "bg-[#FF4D6D] shadow-[0_0_10px_#FF4D6D]" : "bg-[#5A2230]"}`} />
              </span>
              <span className={`text-[10px] font-mono font-bold tracking-widest ${isPlaying ? "text-[#FF8095]" : "text-white/40"}`}>ON AIR</span>
            </div>
            <Link to="/submit">
              <button title="Submit your own track to get it played on BASE Station Radio"
                className="rounded-full px-5 h-10 text-xs font-black inline-flex items-center justify-center gap-1.5 text-[#14100C] transition-transform active:scale-95"
                style={{ background: "linear-gradient(135deg, #FFC26E 0%, #FF9A4D 50%, #FF6B4A 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 12px rgba(255,140,60,0.5)" }}>
                <Upload className="w-3.5 h-3.5" /> Upload Track
              </button>
            </Link>
          </div>
        </div>
      </div>

      <audio ref={audioRef} onEnded={handleTrackEnd} onError={handleAudioError} crossOrigin="anonymous" />
      <audio ref={fallbackRef} onEnded={handleTrackEnd} onError={handleAudioError} />

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