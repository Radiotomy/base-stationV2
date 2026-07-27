import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";

const SCREEN_STYLE = {
  background: "linear-gradient(180deg, #C8EF92 0%, #A9DC66 55%, #96CC54 100%)",
  backgroundImage:
    "radial-gradient(rgba(30,58,14,0.12) 1px, transparent 1px), linear-gradient(180deg, #C8EF92 0%, #A9DC66 55%, #96CC54 100%)",
  backgroundSize: "4px 4px, 100% 100%",
  boxShadow:
    "inset 0 6px 30px rgba(30,58,14,0.35), inset 0 -4px 16px rgba(30,58,14,0.2), 0 0 40px rgba(168,224,99,0.15)",
};

function KnobButton({ label, to, onClick }) {
  const knob = (
    <span className="flex flex-col items-center gap-1.5 group cursor-pointer">
      <span
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-[#FF9A4D]/70 shadow-[0_0_16px_rgba(255,154,77,0.45),inset_0_2px_3px_rgba(255,255,255,0.5),inset_0_-3px_5px_rgba(0,0,0,0.4)] transition-transform group-active:scale-95 flex items-start justify-center pt-1.5"
        style={{ background: "radial-gradient(circle at 35% 30%, #F2F2F2 0%, #B8BCC0 40%, #5A5E62 100%)" }}
      >
        <span className="w-0.5 h-3 bg-[#2A2A2A] rounded" />
      </span>
      <span className="text-[9px] font-mono font-bold tracking-[0.2em] uppercase text-white/60 group-hover:text-white/90 whitespace-nowrap">
        {label}
      </span>
    </span>
  );
  if (to) return <Link to={to} aria-label={label}>{knob}</Link>;
  return <button onClick={onClick} aria-label={label}>{knob}</button>;
}

export default function HomeRackHero({ user }) {
  return (
    <div className="space-y-3">
      {/* ON AIR strip */}
      <div className="rounded-lg border border-black/80 bg-gradient-to-b from-[#161210] to-[#0B0908] py-4 flex justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
        <div className="px-8 py-1.5 rounded-md border-2 border-[#5A2E12] bg-black shadow-[0_0_34px_rgba(255,80,20,0.35),inset_0_0_12px_rgba(255,80,20,0.15)]">
          <span
            className="font-display text-2xl sm:text-3xl tracking-[0.3em] text-[#FF5A1F]"
            style={{ textShadow: "0 0 12px rgba(255,90,30,0.9), 0 0 32px rgba(255,90,30,0.5)" }}
          >
            ON AIR
          </span>
        </div>
      </div>

      {/* Hero display unit */}
      <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#1C1712] to-[#0F0C09] p-3 sm:p-5 shadow-[0_16px_50px_-10px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="rounded-xl border-2 border-black/80 px-5 sm:px-10 py-8 sm:py-12 text-center"
          style={SCREEN_STYLE}
        >
          <div
            className="inline-block rounded-full px-5 py-1.5 mb-6"
            style={{
              background: "linear-gradient(135deg, #FFB347 0%, #FF7A2F 100%)",
              boxShadow: "0 4px 14px -2px rgba(120,60,10,0.5)",
            }}
          >
            <span className="text-[10px] font-black tracking-[0.25em] text-[#2A1508]">AI MUSIC · MADE BY CREATORS</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl leading-[0.98] mb-6 text-[#1F3A0E]">
            Create Boldly.<br />Own It Transparently.
          </h1>

          <p className="text-[#2E4A16]/90 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed font-medium">
            Base Station values human, AI, and hybrid creators equally. Every track carries a RIAA-aligned
            AI disclosure label, a Creative Ownership Score, and an inaudible BASE Mark watermark sealed into
            the audio itself—transparent, traceable credit for your unique voice, however you create.
          </p>
        </motion.div>

        {/* CTA knobs */}
        <div className="flex justify-center gap-8 sm:gap-12 pt-5 pb-1">
          {user ? (
            <>
              <KnobButton label="Radio" to="/radio" />
              {user?.is_creator !== false && <KnobButton label="Create Music" to="/music-studio" />}
              <KnobButton label="Learn Why" to="/why-base-station" />
            </>
          ) : (
            <>
              <KnobButton label="Join Free" onClick={() => base44.auth.redirectToLogin()} />
              <KnobButton label="Explore" to="/radio" />
              <KnobButton label="Learn Why" to="/why-base-station" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}