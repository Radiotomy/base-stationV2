import { VENUE_TEMPLATES } from '@/lib/live/venueTemplates';

/**
 * The shared 8-up template picker. Used by the create wizard and by the
 * Templates tab on an existing venue, so both places always offer the same
 * worlds and describe them the same way.
 */
export default function VenueTemplateGrid({ value, onChange, disabled }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {VENUE_TEMPLATES.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(t.key)}
            className={`text-left p-3 rounded-xl border transition-all disabled:opacity-50 ${
              active ? 'border-accent bg-white/5' : 'border-border hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{t.emoji}</span>
              <p className="text-sm font-bold text-foreground truncate">{t.name}</p>
            </div>
            <p className="text-[10px] text-accent mt-1 font-semibold">{t.genre}</p>
            <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{t.lighting}</p>
          </button>
        );
      })}
    </div>
  );
}