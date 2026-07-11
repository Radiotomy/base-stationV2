import { Link } from "react-router-dom";
import { TrendingUp, Music, ChevronRight } from "lucide-react";
import ActivityFeed from "@/components/feed/ActivityFeed";

const GREEN_SCREEN = {
  background: "linear-gradient(180deg, #C8EF92 0%, #A9DC66 55%, #96CC54 100%)",
  backgroundImage:
    "radial-gradient(rgba(30,58,14,0.12) 1px, transparent 1px), linear-gradient(180deg, #C8EF92 0%, #A9DC66 55%, #96CC54 100%)",
  backgroundSize: "4px 4px, 100% 100%",
  boxShadow: "inset 0 4px 22px rgba(30,58,14,0.35)",
};

const DARK_SCREEN = {
  backgroundColor: "#0C120A",
  backgroundImage: "radial-gradient(rgba(0,0,0,0.55) 1px, transparent 1px)",
  backgroundSize: "4px 4px",
  boxShadow: "inset 0 4px 22px rgba(0,0,0,0.85)",
};

function SideKnob() {
  return (
    <span
      className="hidden lg:block absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-black/60"
      style={{
        background: "radial-gradient(circle at 35% 30%, #FFC98A 0%, #FF9A4D 45%, #C05A20 100%)",
        boxShadow: "0 0 10px rgba(255,154,77,0.4), inset 0 1px 2px rgba(255,255,255,0.6)",
      }}
    />
  );
}

export default function HomePulsePanels({ topTracks }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
      {/* Top Tracks — bright green LCD */}
      <div className="relative rounded-xl border-2 border-black bg-gradient-to-b from-[#1C1712] to-[#0F0C09] p-3 sm:p-4 pl-5 pr-5 lg:pl-8 lg:pr-8 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <SideKnob />
        <span className="lg:hidden" />
        <div className="rounded-lg border-2 border-black/70 p-4" style={GREEN_SCREEN}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-[#1F3A0E]">Top Tracks</h3>
            <Link
              to="/charts"
              className="text-[10px] font-black rounded-full px-3 py-1 flex items-center gap-1 text-[#2A1508]"
              style={{
                background: "linear-gradient(135deg, #FFB347 0%, #FF7A2F 100%)",
                boxShadow: "0 3px 10px -2px rgba(120,60,10,0.5)",
              }}
            >
              Full Charts <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {topTracks.length === 0 ? (
            <div className="text-center py-8 text-[#2E4A16]/70">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">Charts will populate as the community votes!</p>
            </div>
          ) : (
            <div>
              {topTracks.map((track, i) => (
                <Link
                  to="/charts"
                  key={track.id}
                  className="flex items-center gap-3 py-2 border-b border-[#1F3A0E]/20 last:border-0 hover:bg-[#1F3A0E]/5 transition-colors rounded-sm px-1"
                >
                  <span className="w-6 h-6 rounded-full bg-[#1F3A0E] text-[#C8EF92] text-[11px] font-black flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded overflow-hidden bg-[#1F3A0E]/15 flex-shrink-0">
                    {track.cover_image_url
                      ? <img src={track.cover_image_url} alt={track.track_title} className="w-full h-full object-cover" />
                      : <Music className="w-3.5 h-3.5 m-2 text-[#1F3A0E]/50" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate text-[#1F3A0E]">{track.track_title}</p>
                    <p className="text-[11px] text-[#2E4A16]/70 truncate font-medium">{track.artist_name}</p>
                    <div className="h-1 mt-1 rounded-full bg-[#1F3A0E]/15 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#1F3A0E]/60"
                        style={{
                          width: `${Math.max(8, Math.round(((track.total_votes || 0) / Math.max(1, topTracks[0]?.total_votes || 1)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-black text-[#1F3A0E] flex-shrink-0">
                    {track.total_votes?.toLocaleString() || 0}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Community Buzz — dark phosphor screen */}
      <div className="relative rounded-xl border-2 border-black bg-gradient-to-b from-[#1C1712] to-[#0F0C09] p-3 sm:p-4 pl-5 pr-5 lg:pl-8 lg:pr-8 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <SideKnob />
        <div className="rounded-lg border-2 border-black/70 p-4 h-full" style={DARK_SCREEN}>
          <h3
            className="font-display text-lg text-[#C6F27E] mb-3"
            style={{ textShadow: "0 0 10px rgba(198,242,126,0.5)" }}
          >
            Community Buzz
          </h3>
          <ActivityFeed limit={8} />
        </div>
      </div>
    </div>
  );
}