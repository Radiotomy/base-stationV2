/**
 * Military rack-mount unit frame — dark chassis, side rails with
 * mounting holes, corner screws, stenciled unit label + amber rules.
 */
function Screw() {
  return (
    <span className="relative inline-block w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#3A322A] to-[#0E0B08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
      <span className="absolute inset-0 flex items-center justify-center text-[6px] text-black/70 leading-none">✕</span>
    </span>
  );
}

function RailHoles() {
  return (
    <div className="hidden sm:flex flex-col justify-around items-center w-6 self-stretch py-6 flex-shrink-0">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2.5 h-4 rounded-full bg-[#050403] shadow-[inset_0_1px_2px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)]" />
      ))}
    </div>
  );
}

export default function RackUnit({ title, badge, badgeColor = "amber", children }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-black/80 bg-gradient-to-b from-[#221B14] via-[#191410] to-[#14100C] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex">
        <RailHoles />
        <div className="flex-1 min-w-0 px-3 sm:px-4 pb-5">
          {/* Header */}
          <div className="flex items-center gap-3 pt-3 pb-2">
            <Screw />
            <span className="h-px flex-none w-4 bg-[#FF9A4D]/50" />
            <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#D9CBB8] whitespace-nowrap">{title}</span>
            <span className="h-px flex-1 bg-[#FF9A4D]/50" />
            {badge && (
              badgeColor === "amber"
                ? <span className="text-xs font-black text-[#FF9A4D] tracking-wide whitespace-nowrap">{badge}</span>
                : <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#C6F27E] border border-[#C6F27E]/30 bg-[#0C120A] rounded-full px-2.5 py-0.5 whitespace-nowrap">{badge}</span>
            )}
            <Screw />
          </div>
          <div className="h-px bg-[#FF9A4D]/25 mb-4" />

          {children}

          {/* Bottom rule + screws */}
          <div className="mt-5 h-px bg-[#FF9A4D]/25" />
          <div className="flex items-center justify-between pt-2">
            <Screw />
            <span className="h-0.5 flex-1 mx-3 rounded bg-black/40 shadow-[inset_0_1px_1px_rgba(0,0,0,0.8)]" />
            <Screw />
          </div>
        </div>
        <RailHoles />
      </div>
    </div>
  );
}