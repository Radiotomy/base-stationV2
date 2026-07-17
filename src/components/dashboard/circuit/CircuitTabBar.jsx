/**
 * Circuit-styled tab rail — slim modules with an LED indicator dot
 * and mono uppercase labels.
 * Props: tabs = [{ key, label, icon: LucideIcon, count? }], activeTab, onChange
 */
export default function CircuitTabBar({ tabs = [], activeTab, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {tabs.map(({ key, label, icon: Icon, count }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
              active
                ? "border-[#FF9A4D]/50 bg-[#FF9A4D]/10 text-[#FFC98A]"
                : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full transition-all ${active ? "bg-[#FF9A4D]" : "bg-muted-foreground/30"}`}
              style={active ? { boxShadow: "0 0 6px #FF9A4D" } : undefined}
            />
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
            {count !== undefined && (
              <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${active ? "bg-[#FF9A4D]/20" : "bg-muted"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}