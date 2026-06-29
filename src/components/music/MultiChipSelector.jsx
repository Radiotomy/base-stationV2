import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomChips } from '@/hooks/useCustomChips';

/**
 * Multi-select chip picker with custom chip support.
 * Persists custom chips through the CustomChip entity so they survive reloads
 * and are shared across sessions.
 *
 * Props:
 *   chipType    - 'genre' | 'mood' | 'style' (any key supported by useCustomChips)
 *   defaults    - array of default chip values
 *   selected    - array of currently selected chip values
 *   onChange    - (nextArray) => void
 *   activeClass - tailwind class for active chip (e.g. 'bg-pink-600 text-white')
 *   addLabel    - placeholder text for the inline add input
 */
export default function MultiChipSelector({
  chipType,
  defaults = [],
  selected = [],
  onChange,
  activeClass = 'bg-blue-600 text-white',
  addLabel,
}) {
  const { customChips, addChip } = useCustomChips(chipType);
  const [adding, setAdding] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const allChips = [...defaults, ...customChips.filter(c => !defaults.includes(c))];

  const toggle = (chip) => {
    if (selected.includes(chip)) {
      onChange(selected.filter(c => c !== chip));
    } else {
      onChange([...selected, chip]);
    }
  };

  const handleAdd = async () => {
    const val = inputVal.trim();
    if (!val) return;
    if (allChips.includes(val)) {
      // Just select it if it already exists
      if (!selected.includes(val)) onChange([...selected, val]);
      toast.success(`"${val}" selected`);
    } else {
      const ok = await addChip(val);
      if (ok) {
        onChange([...selected, val]);
        toast.success(`"${val}" added!`);
      } else {
        toast.error('Could not add');
      }
    }
    setInputVal('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {allChips.map(chip => {
        const active = selected.includes(chip);
        return (
          <button
            key={chip}
            type="button"
            onClick={() => toggle(chip)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              active ? activeClass : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {chip}
          </button>
        );
      })}

      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
              if (e.key === 'Escape') { setAdding(false); setInputVal(''); }
            }}
            placeholder={addLabel || `Custom ${chipType}…`}
            className="w-28 px-2 py-0.5 rounded-lg text-xs border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setInputVal(''); }}
            className="text-xs text-muted-foreground hover:text-foreground px-1"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          title={`Add custom ${chipType}`}
          className="px-2 py-1 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted border border-dashed border-border hover:border-border/80 transition-all flex items-center gap-0.5"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      )}
    </div>
  );
}