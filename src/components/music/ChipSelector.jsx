import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomChips } from '@/hooks/useCustomChips';

/**
 * Reusable chip selector with custom chip support.
 * Props:
 *   chipType   - 'genre' | 'mood' | 'duration'
 *   defaults   - array of default chip values
 *   selected   - currently selected value (or null for "any")
 *   onSelect   - (value) => void  (null = deselect / "any")
 *   activeClass  - tailwind class for active chip
 *   labelSuffix  - optional string appended to each chip label (e.g. 's' for durations)
 *   allowAny   - if true, shows an "Any" chip that deselects (passes null)
 *   anyLabel   - label for the any chip (default "Any")
 */
export default function ChipSelector({
  chipType,
  defaults,
  selected,
  onSelect,
  activeClass = 'bg-blue-600 text-white',
  labelSuffix = '',
  allowAny = false,
  anyLabel = 'Any',
}) {
  const { customChips, addChip } = useCustomChips(chipType);
  const [adding, setAdding] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const allChips = [...defaults, ...customChips.filter(c => !defaults.includes(c))];

  const handleAdd = async () => {
    if (!inputVal.trim()) return;
    const ok = await addChip(inputVal.trim());
    if (ok) {
      toast.success(`"${inputVal.trim()}" added!`);
      onSelect(inputVal.trim());
    } else {
      toast.error('Could not add chip');
    }
    setInputVal('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {allowAny && (
        <button
          onClick={() => onSelect(null)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            selected === null ? activeClass : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {anyLabel}
        </button>
      )}
      {allChips.map(chip => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            selected === chip ? activeClass : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {chip}{labelSuffix}
        </button>
      ))}

      {/* Add custom chip */}
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setAdding(false); setInputVal(''); }
            }}
            placeholder={chipType === 'duration' ? 'e.g. 45' : `Custom ${chipType}…`}
            className="w-24 px-2 py-0.5 rounded-lg text-xs border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
          />
          <button onClick={handleAdd}
            className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={() => { setAdding(false); setInputVal(''); }}
            className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
        </div>
      ) : (
        <button
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