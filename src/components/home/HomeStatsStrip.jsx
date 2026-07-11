const STATS = [
  { label: "AI Tracks Created", value: "10K+" },
  { label: "Live Sessions", value: "500+" },
  { label: "Community Artists", value: "2K+" },
  { label: "Countries", value: "80+" },
];

export default function HomeStatsStrip() {
  return (
    <div
      className="rounded-lg border border-black/60 px-4 sm:px-6 py-4"
      style={{
        background: "linear-gradient(180deg, #C9CDD1 0%, #A8ACB0 30%, #8E9296 55%, #B4B8BC 80%, #D4D8DC 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.4), 0 6px 18px rgba(0,0,0,0.5)",
      }}
    >
      <h3 className="text-center text-[#14100C] font-black text-sm sm:text-base mb-3">Base Station by the Numbers</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {STATS.map(({ label, value }) => (
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
              {value}
            </p>
            <p className="text-[10px] sm:text-xs text-[#FF9A4D]/70 font-semibold mt-1.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}