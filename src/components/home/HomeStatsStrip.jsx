import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Truth-in-disclosure: every number here is a live count from the database —
// no marketing floors, no fabricated values.
export default function HomeStatsStrip() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      base44.entities.TrackSubmission.list("-created_date", 1000),
      base44.entities.LiveSession.list("-created_date", 1000),
      base44.entities.UserXP.list("-created_date", 1000),
      base44.entities.Playlist.list("-created_date", 1000),
    ]).then(([t, s, u, p]) => {
      if (!alive) return;
      const count = (r) => (r.status === "fulfilled" ? (r.value || []).length : 0);
      setStats([
        { label: "Tracks Submitted", value: count(t) },
        { label: "Live Sessions", value: count(s) },
        { label: "Community Creators", value: count(u) },
        { label: "Playlists", value: count(p) },
      ]);
    });
    return () => { alive = false; };
  }, []);

  const display = stats || [
    { label: "Tracks Submitted", value: "—" },
    { label: "Live Sessions", value: "—" },
    { label: "Community Creators", value: "—" },
    { label: "Playlists", value: "—" },
  ];

  return (
    <div
      className="rounded-lg border border-black/60 px-4 sm:px-6 py-4"
      style={{
        background: "linear-gradient(180deg, #C9CDD1 0%, #A8ACB0 30%, #8E9296 55%, #B4B8BC 80%, #D4D8DC 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.4), 0 6px 18px rgba(0,0,0,0.5)",
      }}
    >
      <h3 className="text-center text-[#14100C] font-black text-sm sm:text-base mb-3">Base Station by the Numbers — Live</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {display.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-md border border-black px-4 py-3 text-center"
            style={{
              background: "linear-gradient(180deg, #0D0B09 0%, #1A1512 100%)",
              boxShadow: "inset 0 2px 10px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <p
              className="font-display text-2xl sm:text-4xl leading-none text-[#FF8A3D]"
              style={{ textShadow: "0 0 10px rgba(255,138,61,0.8), 0 0 26px rgba(255,138,61,0.4)" }}
            >
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            <p className="text-[10px] sm:text-xs text-[#FF9A4D]/70 font-semibold mt-1.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}