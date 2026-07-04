import { useEffect, useMemo, useState } from 'react';
import butterchurnPresets from 'butterchurn-presets';
import { Shuffle } from 'lucide-react';
import { Input } from '@/components/ui/input';

const NAMES = Object.keys(butterchurnPresets.getPresets()).sort();

export default function PresetPicker({ value, onChange }) {
  const [search, setSearch] = useState('');

  // Default to a random preset on first load
  useEffect(() => {
    if (!value) onChange(NAMES[Math.floor(Math.random() * NAMES.length)]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () => NAMES.filter(n => n.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${NAMES.length} MilkDrop presets…`} className="h-8 text-xs" />
        <button onClick={() => onChange(NAMES[Math.floor(Math.random() * NAMES.length)])}
          title="Random preset"
          className="shrink-0 w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:border-purple-500 transition-colors">
          <Shuffle className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
        {filtered.map(n => (
          <button key={n} onClick={() => onChange(n)}
            className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] leading-tight transition-colors border ${value === n
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
              : 'text-muted-foreground border-transparent hover:bg-muted/50'}`}>
            {n}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-3">No presets match "{search}"</p>
        )}
      </div>
      {value && (
        <p className="text-[10px] text-muted-foreground truncate">
          Selected: <span className="text-foreground">{value}</span>
        </p>
      )}
    </div>
  );
}