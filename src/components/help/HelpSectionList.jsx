import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import HelpSection from '@/components/help/HelpSection';

/** Searchable, collapsible list of help sections — shared by /help and topic guides. */
export default function HelpSectionList({ sections, placeholder = 'Search help…', openHash = true }) {
  const [q, setQ] = useState('');
  const hash = openHash ? window.location.hash.slice(1) : '';

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return sections;
    return sections.filter((s) => s.title.toLowerCase().includes(term) || (s.keywords || '').toLowerCase().includes(term));
  }, [q, sections]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-9 h-11 rounded-xl bg-card/60 border-white/10" />
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No sections match "{q}".</p>}
        {filtered.map((s, i) => (
          <HelpSection key={s.id} id={s.id} title={s.title} icon={s.icon}
            defaultOpen={!q && (hash ? s.id === hash : i === 0)}>
            {s.body}
          </HelpSection>
        ))}
      </div>
    </div>
  );
}