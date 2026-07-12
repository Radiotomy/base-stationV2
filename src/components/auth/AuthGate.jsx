import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const SCREEN_STYLE = {
  background: "linear-gradient(180deg, #C8EF92 0%, #A9DC66 55%, #96CC54 100%)",
  backgroundImage:
    "radial-gradient(rgba(30,58,14,0.12) 1px, transparent 1px), linear-gradient(180deg, #C8EF92 0%, #A9DC66 55%, #96CC54 100%)",
  backgroundSize: "4px 4px, 100% 100%",
  boxShadow: "inset 0 6px 30px rgba(30,58,14,0.35), 0 0 40px rgba(168,224,99,0.15)",
};

function GateKnob({ label, onClick, to }) {
  const knob = (
    <span className="flex flex-col items-center gap-1.5 group cursor-pointer">
      <span
        className="w-12 h-12 rounded-full border-2 border-[#FF9A4D]/70 shadow-[0_0_16px_rgba(255,154,77,0.45),inset_0_2px_3px_rgba(255,255,255,0.5),inset_0_-3px_5px_rgba(0,0,0,0.4)] transition-transform group-active:scale-95 flex items-start justify-center pt-1.5"
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

export default function AuthGate() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: "#0A0806" }}>
      <div className="w-full max-w-lg rounded-xl border-2 border-black bg-gradient-to-b from-[#1A1512] via-[#131009] to-[#0E0B08] p-3 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
        {/* Lamp strip */}
        <div className="rounded-lg border border-black/80 bg-gradient-to-b from-[#161210] to-[#0B0908] py-3 flex justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] mb-3">
          <div className="px-6 py-1 rounded-md border-2 border-[#5A2E12] bg-black shadow-[0_0_28px_rgba(255,80,20,0.35)]">
            <span
              className="font-display text-lg tracking-[0.3em] text-[#FF5A1F]"
              style={{ textShadow: "0 0 12px rgba(255,90,30,0.9), 0 0 28px rgba(255,90,30,0.5)" }}
            >
              MEMBERS ONLY
            </span>
          </div>
        </div>

        {/* Screen */}
        <div className="rounded-xl border-2 border-black/80 px-6 py-8 text-center" style={SCREEN_STYLE}>
          <div
            className="inline-block rounded-full px-4 py-1 mb-4"
            style={{ background: "linear-gradient(135deg, #FFB347 0%, #FF7A2F 100%)", boxShadow: "0 4px 14px -2px rgba(120,60,10,0.5)" }}
          >
            <span className="text-[9px] font-black tracking-[0.25em] text-[#2A1508]">BASE STATION ACCESS</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-[#1F3A0E] mb-3">Sign In to Continue</h1>
          <p className="text-[#2E4A16]/90 text-xs sm:text-sm font-medium leading-relaxed max-w-sm mx-auto">
            This station is reserved for members. Sign in or create a free account to unlock the studios, radio, charts, and your creator workspace.
          </p>
        </div>

        {/* Knobs */}
        <div className="flex justify-center gap-10 pt-5 pb-2">
          <GateKnob label="Sign In" onClick={() => base44.auth.redirectToLogin()} />
          <GateKnob label="Join Free" onClick={() => base44.auth.redirectToLogin()} />
          <GateKnob label="Back Home" to="/" />
        </div>
      </div>
    </div>
  );
}