import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

function PanelKnob({ topLabel, bottomLabel }) {
  return (
    <div className="hidden md:flex flex-col items-center gap-1.5 flex-shrink-0">
      <span className="text-[8px] font-mono font-bold text-[#3A342E]">{topLabel}</span>
      <span
        className="w-14 h-14 rounded-full border-2 border-[#7A4A1E] flex items-start justify-center pt-2"
        style={{
          background: "radial-gradient(circle at 35% 30%, #FFC98A 0%, #FF9A4D 40%, #B05018 100%)",
          boxShadow: "0 4px 14px rgba(180,90,30,0.5), inset 0 2px 3px rgba(255,255,255,0.6), inset 0 -4px 6px rgba(120,50,10,0.5)",
        }}
      >
        <span className="w-1 h-4 bg-[#5A2E12] rounded" />
      </span>
      <span className="text-[8px] font-mono font-bold text-[#3A342E]">{bottomLabel}</span>
    </div>
  );
}

export default function HomeCTAPanel({ user }) {
  return (
    <div
      className="rounded-lg border border-black/60 px-5 sm:px-8 py-6"
      style={{
        background: "linear-gradient(180deg, #C9CDD1 0%, #A8ACB0 30%, #8E9296 55%, #B4B8BC 80%, #D4D8DC 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.4), 0 6px 18px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center gap-6 sm:gap-10">
        <PanelKnob topLabel="ON" bottomLabel="OFF" />

        <div className="flex-1 text-center">
          <h2
            className="font-display text-4xl sm:text-6xl mb-4 bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(110deg, #FFB347 0%, #FF8A3D 50%, #FF6B4A 100%)",
              WebkitBackgroundClip: "text",
              textShadow: "0 2px 0 rgba(255,255,255,0.25)",
            }}
          >
            Human + AI
          </h2>
          <p className="text-[#2A2620] text-xs sm:text-sm mb-5 leading-relaxed max-w-xl mx-auto font-medium">
            Base Station believes AI is a co-creator. Your creativity drives the music — AI amplifies it. Every
            track carries a transparent disclosure label and Creative Ownership Score.
          </p>
          {user ? (
            <Link to="/radio">
              <button
                className="rounded-full px-8 py-2.5 font-black text-sm text-[#2A1508] transition-transform active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #FFC26E 0%, #FF9A4D 50%, #FF6B4A 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 14px rgba(255,140,60,0.5)",
                }}
              >
                Go to Radio
              </button>
            </Link>
          ) : (
            <button
              onClick={() => base44.auth.redirectToLogin()}
              className="rounded-full px-8 py-2.5 font-black text-sm text-[#2A1508] transition-transform active:scale-95"
              style={{
                background: "linear-gradient(135deg, #FFC26E 0%, #FF9A4D 50%, #FF6B4A 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 14px rgba(255,140,60,0.5)",
              }}
            >
              Join Base Station
            </button>
          )}
        </div>

        <PanelKnob topLabel="GAIN" bottomLabel="10" />
      </div>

      <div className="mt-5 pt-3 border-t border-black/20 text-center text-[10px] text-[#3A342E] font-semibold">
        BaseStation &nbsp;·&nbsp; © 2026 BaseStation. All Creators Welcome.
      </div>
    </div>
  );
}