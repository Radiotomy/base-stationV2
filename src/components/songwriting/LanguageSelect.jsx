import { useState } from 'react';
import { Languages } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LANGUAGE_GROUPS, DEFAULT_LANGUAGE, isEnglishLanguage } from '@/config/lyricLanguages';

const CUSTOM = '__custom__';

/**
 * Lyric / vocal language picker. The chosen language drives BOTH the lyric
 * engines and the music model's vocal, so it is a single control rather than one
 * setting per engine. "Other" accepts any language or regional tradition —
 * nothing in the pipeline restricts it to the listed options.
 */
export default function LanguageSelect({ value = DEFAULT_LANGUAGE, onChange, compact = false }) {
  const known = LANGUAGE_GROUPS.some(g => g.items.includes(value));
  const [custom, setCustom] = useState(known ? '' : value);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
        <Languages className="w-3.5 h-3.5 text-cyan-300" /> Language
        {!isEnglishLanguage(value) && <span className="text-cyan-300 normal-case font-bold">{value}</span>}
      </label>
      <select
        value={known ? value : CUSTOM}
        onChange={(e) => {
          if (e.target.value === CUSTOM) onChange(custom || '');
          else onChange(e.target.value);
        }}
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {LANGUAGE_GROUPS.map(g => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map(item => (
              <option key={`${g.group}-${item}`} value={item} className="bg-background">{item}</option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM} className="bg-background">Other language / tradition…</option>
      </select>
      {!known && (
        <Input
          value={custom}
          onChange={(e) => { setCustom(e.target.value); onChange(e.target.value); }}
          placeholder="e.g. Sicilian, Wolof, Tejano Spanglish, Scots"
          className="rounded-xl bg-background text-sm"
        />
      )}
      {!compact && (
        <p className="text-[10px] text-muted-foreground leading-tight">
          Lyrics are written in this language and the vocal is generated in it too — section tags stay in English so the music model can read the structure.
        </p>
      )}
    </div>
  );
}