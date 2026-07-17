/**
 * Circuit-board style stat strip — compact modules connected by a PCB trace
 * with node dots, replacing the bulky stat card grid.
 * Props: stats = [{ icon: LucideIcon, label: string, value: string|number, accent?: string }]
 */
export default function CircuitStatStrip({ stats = [] }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card/60 overflow-hidden">
      {/* top trace line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF9A4D]/60 to-transparent" />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y sm:divide-y lg:divide-y-0 divide-border/60">
        {stats.map(({ icon: Icon, label, value, accent = "#FF9A4D" }) => (
          <div key={label} className="relative p-3.5 group">
            {/* node dot */}
            <span
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full opacity-0 lg:opacity-100"
              style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
            />
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon className="w-3 h-3" style={{ color: accent }} />
              <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground truncate">{label}</p>
            </div>
            <p className="text-xl font-black text-foreground leading-none tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}