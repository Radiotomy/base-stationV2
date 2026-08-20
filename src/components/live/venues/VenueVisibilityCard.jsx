import { useState } from 'react';
import { Globe, Link2, Lock, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const OPTIONS = [
  {
    value: 'public',
    label: 'Public',
    icon: Globe,
    detail: 'Listed in the BASE Station venue directory. Anyone can find and enter.',
  },
  {
    value: 'unlisted',
    label: 'Unlisted',
    icon: Link2,
    detail: 'Plays normally, but only people with your link can reach it.',
  },
  {
    value: 'private',
    label: 'Private',
    icon: Lock,
    detail: 'The public venue page is closed. Only you can open it from Live Studio.',
  },
];

/**
 * Who may find and enter this venue from BASE Station.
 *
 * Defaults to unlisted for every existing venue — a directory launched after a
 * room was built must never publish that room on the creator's behalf.
 */
export default function VenueVisibilityCard({ venue, onUpdated }) {
  const [saving, setSaving] = useState('');
  const current = venue.visibility || 'unlisted';

  const setVisibility = async (value) => {
    if (value === current) return;
    setSaving(value);
    try {
      await base44.entities.PortalVenue.update(venue.id, { visibility: value });
      toast.success(`Venue set to ${value}`);
      onUpdated?.();
    } catch {
      toast.error('Could not update visibility');
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="merc-card rounded-3xl p-5 space-y-4">
      <div>
        <p className="font-display text-lg">Who can find this venue</p>
        <p className="text-xs text-muted-foreground mt-1">
          Controls BASE Station surfaces. Your Portals room keeps its own access settings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OPTIONS.map(({ value, label, icon: Icon, detail }) => {
          const active = current === value;
          return (
            <button
              key={value}
              onClick={() => setVisibility(value)}
              disabled={!!saving}
              className={`text-left rounded-2xl p-4 border transition-colors ${
                active ? 'border-accent bg-white/5' : 'border-border hover:border-white/25'
              } disabled:opacity-60`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {saving === value
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Icon className={`w-4 h-4 ${active ? 'text-accent' : 'text-muted-foreground'}`} />}
                <span className="text-sm font-bold">{label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">{detail}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}