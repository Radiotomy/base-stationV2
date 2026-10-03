import { useState, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import VenueTemplateGrid from './VenueTemplateGrid';
import { getVenueTemplate } from '@/lib/live/venueTemplates';

/**
 * Lets an artist change their venue's world at any time. Only the environment
 * changes — the room link, name, cover and stage screen all carry over.
 */
export default function VenueTemplatesTab({ venue, onUpdated }) {
  const current = venue.template_key;
  const [selected, setSelected] = useState(current);
  const [busy, setBusy] = useState(false);
  // Keep the picker in step when the template is changed elsewhere (e.g. by the Venue Architect).
  useEffect(() => { setSelected(current); }, [current]);

  const apply = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('applyVenueTemplate', {
        venueId: venue.id,
        templateKey: selected,
      });
      if (!res?.data?.ok) throw new Error(res?.data?.error || 'Could not apply that template');
      // Best-effort: a brand-new room can still be warming up, and the next
      // scheduled sweep will hang the artwork anyway — never fail the switch on it.
      base44.functions.invoke('advanceVenueStages', { venueId: venue.id }).catch(() => {});
      toast.success(`${getVenueTemplate(selected).name} applied — your fan link has changed, share the new one`);
      onUpdated?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  return (
    <div className="merc-card rounded-2xl p-5 space-y-4">
      <div>
        <p className="font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" /> Venue Template
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Switch worlds anytime. Switching builds a fresh room in the new style and carries over your name, cover,
          stage screen and in-world panel — but it gives you a new fan link, so share the updated one.
        </p>
      </div>

      <VenueTemplateGrid value={selected} onChange={setSelected} disabled={busy} />

      <Button
        onClick={apply}
        disabled={busy || selected === current}
        className="rounded-lg h-10 font-bold gap-2 w-full sm:w-auto"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {busy ? 'Rebuilding the space…' : selected === current ? 'Currently applied' : 'Apply Template'}
      </Button>
    </div>
  );
}