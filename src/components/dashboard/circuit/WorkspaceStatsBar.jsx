import { useState } from "react";
import { ChevronDown } from "lucide-react";
import CircuitStatStrip from "@/components/dashboard/circuit/CircuitStatStrip";

/**
 * Collapsible wrapper around CircuitStatStrip — collapsed by default to a single
 * compact summary line, expandable to the full 8-metric circuit strip. Keeps
 * every stat available without permanently occupying the vertical space.
 */
export default function WorkspaceStatsBar({ stats = [] }) {
  const [open, setOpen] = useState(false);
  const highlights = stats.slice(0, 4);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-border bg-card/60 hover:border-[#FF9A4D]/40 transition-colors group">
        <div className="flex items-center gap-4 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {highlights.map(({ icon: Icon, label, value, accent = "#FF9A4D" }) => (
            <div key={label} className="flex items-center gap-1.5 flex-shrink-0">
              <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
              <span className="text-sm font-black text-foreground tabular-nums">{value}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hidden sm:inline">{label}</span>
            </div>
          ))}
          <span className="text-[10px] text-muted-foreground flex-shrink-0">+{Math.max(0, stats.length - highlights.length)} more</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-[#FFC98A] transition-colors flex-shrink-0" />
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <CircuitStatStrip stats={stats} />
      <button onClick={() => setOpen(false)}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown className="w-3.5 h-3.5 rotate-180" /> Collapse Stats
      </button>
    </div>
  );
}