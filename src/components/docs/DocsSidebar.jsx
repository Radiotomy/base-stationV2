import { BookOpen, Calculator, FileOutput, FileCheck, Music4, Braces } from 'lucide-react';

export const DOC_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: BookOpen, group: 'Getting Started' },
  { id: 'cos-calculate', label: 'Calculate COS', icon: Calculator, group: 'API Reference' },
  { id: 'ddex-export', label: 'DDEX Export', icon: FileOutput, group: 'API Reference' },
  { id: 'provenance-manifest', label: 'Provenance Manifest', icon: FileCheck, group: 'API Reference' },
  { id: 'id3-compliance', label: 'ID3v2 Compliance', icon: Music4, group: 'Standards' },
];

export default function DocsSidebar({ active, onSelect }) {
  const groups = [...new Set(DOC_SECTIONS.map((s) => s.group))];

  return (
    <nav className="space-y-6">
      <div className="flex items-center gap-2 px-2">
        <Braces className="w-5 h-5 text-[#FF9A4D]" />
        <span className="font-display text-sm text-foreground">Developer Hub</span>
      </div>
      {groups.map((group) => (
        <div key={group}>
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {group}
          </p>
          <ul className="space-y-0.5">
            {DOC_SECTIONS.filter((s) => s.group === group).map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => onSelect(s.id)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-left transition-colors ${
                      isActive
                        ? 'bg-[#FF9A4D]/10 text-[#FFC98A] border-l-2 border-[#FF9A4D] font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60 border-l-2 border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}