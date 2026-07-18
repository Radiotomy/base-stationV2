import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, LayoutGrid } from "lucide-react";

const STUDIOS = [
  { to: "/studios", label: "🎛️ All Studios" },
  { to: "/music-studio", label: "🎵 Music Studio" },
  { to: "/lyrics-studio", label: "🎤 Lyrics Studio" },
  { to: "/cover-art-studio", label: "🎨 Cover Art Studio" },
  { to: "/video-studio", label: "🎬 Video Studio" },
  { to: "/sfx-studio", label: "🔊 Sound FX Studio" },
  { to: "/voice-creator", label: "🗣️ Voice Creator" },
  { to: "/stem-creator", label: "🎚️ Stem Creator" },
  { to: "/mashup-studio", label: "🌀 Mashup Studio" },
  { to: "/vocal-harmonizer", label: "🎶 Vocal Harmonizer" },
  { to: "/mastering-studio", label: "💿 Mastering Studio" },
  { to: "/audio-remix-studio", label: "🎧 Audio Remix" },
  { to: "/cover-song-studio", label: "🎸 Cover Song Studio" },
  { to: "/visualizer-studio", label: "📺 Visualizer Studio" },
  { to: "/promo-studio", label: "📣 Promo Studio" },
  { to: "/id3-studio", label: "🏷️ ID3 Tag Studio" },
  { to: "/live-studio", label: "📡 Live Studio" },
  { to: "/ai-studio", label: "⚡ AI Tools" },
];

const STUDIO_PATHS = new Set(STUDIOS.map((s) => s.to));

/** Quick-jump between studios — renders only on studio pages. */
export default function StudioSwitcher({ currentPath }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!STUDIO_PATHS.has(currentPath)) return null;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-[#FF9A4D] border border-[#FF9A4D]/30 bg-gradient-to-b from-[#28211A] to-[#171310] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:border-[#FF9A4D]/60 transition-all"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        Switch Studio
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute right-0 mt-2 w-56 max-h-96 overflow-y-auto rounded-lg border-2 border-black bg-gradient-to-b from-[#221B14] to-[#0F0C09] shadow-[0_12px_36px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)] p-2 space-y-0.5 z-50"
          >
            {STUDIOS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`block px-3 py-1.5 rounded-lg text-sm transition-all ${
                  currentPath === to
                    ? "text-[#FF9A4D] bg-white/5 font-bold"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                {label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}