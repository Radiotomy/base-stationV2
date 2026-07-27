/**
 * Native-style vertical workspace nav — replaces the wide horizontal tab rail
 * on desktop so the section list doesn't eat vertical space above the content.
 * Props: tabs = [{ key, label, icon: LucideIcon, count?, tip? }], activeTab, onChange
 */
export default function WorkspaceSidebarNav({ tabs = [], activeTab, onChange }) {
  return (
    <nav className="hidden lg:flex flex-col gap-1">
      {tabs.map(({ key, label, icon: Icon, count, tip }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            title={tip}
            onClick={() => onChange(key)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left border ${
              active
                ? "bg-[#FF9A4D]/10 text-[#FFC98A] border-[#FF9A4D]/40"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
            <span className="flex-1 truncate">{label}</span>
            {count !== undefined && (
              <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${active ? "bg-[#FF9A4D]/20" : "bg-muted"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}