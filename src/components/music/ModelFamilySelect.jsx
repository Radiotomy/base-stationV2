import { useState, useEffect } from 'react';

/**
 * Two-level AI model picker — first row lists model FAMILIES by public name
 * (Suno, TemPolor, Lyria, Mureka, MiniMax, Eleven Music…). Hovering or
 * selecting a family reveals its version list underneath.
 *
 * Props:
 * - families: [{ name, maker, versions: [{ value, label, desc }] }]
 * - value: currently selected version value
 * - onSelect(value)
 * - accentClass: literal Tailwind classes for the active state
 */
export default function ModelFamilySelect({ families, value, onSelect, accentClass = 'border-amber-500 bg-amber-500/10' }) {
  const familyOf = (val) => families.find(f => f.versions.some(v => v.value === val))?.name || null;
  const [openFamily, setOpenFamily] = useState(() => familyOf(value) || families[0]?.name);

  // Re-sync when the family list changes (e.g. song ↔ instrumental mode switch)
  useEffect(() => {
    if (!families.some(f => f.name === openFamily)) {
      setOpenFamily(familyOf(value) || families[0]?.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [families]);

  const selectedFamily = familyOf(value);
  const open = families.find(f => f.name === openFamily);

  return (
    <div className="space-y-2">
      {/* Level 1 — model family names */}
      <div className="flex flex-wrap gap-1.5">
        {families.map(f => (
          <button key={f.name} type="button"
            onClick={() => setOpenFamily(f.name)}
            onMouseEnter={() => setOpenFamily(f.name)}
            className={`px-3 py-1.5 rounded-lg border text-left transition-all ${openFamily === f.name ? accentClass : 'border-border bg-card hover:border-border/60'}`}>
            <p className="text-xs font-bold text-foreground">
              {f.name}{selectedFamily === f.name && <span className="ml-1 text-emerald-400">✓</span>}
            </p>
            <p className="text-[10px] text-muted-foreground">{f.maker}</p>
          </button>
        ))}
      </div>

      {/* Level 2 — versions of the open family */}
      {open && (
        <div className="grid grid-cols-2 gap-1.5">
          {open.versions.map(v => (
            <button key={v.value} type="button" onClick={() => onSelect(v.value)}
              className={`px-2.5 py-2 rounded-lg border text-left transition-all ${value === v.value ? accentClass : 'border-border bg-card hover:border-border/60'}`}>
              <p className="text-xs font-bold text-foreground">{open.name} {v.label}</p>
              <p className="text-xs text-muted-foreground">{v.desc}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}