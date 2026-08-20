import { useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { STAFF_ROLES } from '@/lib/live/venueStaffRoles';
import VenueStaffRow from './VenueStaffRow';

/**
 * Venue staff — the AI characters standing in the artist's 3D room.
 *
 * The roster is always the four fixed roles, so a saved member is matched to its
 * role rather than appended: an artist editing the bartender must not end up with
 * two bartenders.
 */
export default function VenueStaffCard({ venue, onUpdated }) {
  const [members, setMembers] = useState(() =>
    STAFF_ROLES.map((role) => {
      const saved = (venue.staff || []).find((m) => m.role === role.key);
      return saved || { role: role.key, name: role.label, glb_url: '', enabled: false, animation: role.defaultAnimation };
    }),
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const active = members.filter((m) => m.enabled !== false);
    const missing = active.find((m) => !(m.glb_url || '').startsWith('https://'));
    if (missing) {
      toast.error('Each active character needs an https link to a rigged GLB avatar');
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('pushVenueStaff', { venueId: venue.id, staff: members });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(res.data.placed ? `${res.data.placed} character(s) placed in your venue` : 'Staff cleared from your venue');
      onUpdated?.();
    } catch (err) {
      toast.error(err.message || 'Could not update your venue staff');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="merc-card rounded-3xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-accent" />
        <h2 className="text-lg font-display">Venue Staff</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        AI characters who greet fans and talk about your music. They only know what your venue can back up —
        the venue name, your name and what is playing — and are instructed never to invent anything else.
      </p>
      <p className="text-xs text-muted-foreground">
        Your 3D room has to be awake to be updated — if saving fails, open the room link above for a few
        seconds first, then save again.
      </p>

      <div className="space-y-3">
        {STAFF_ROLES.map((role, i) => (
          <VenueStaffRow
            key={role.key}
            role={role}
            member={members[i]}
            onChange={(next) => setMembers(members.map((m, j) => (j === i ? next : m)))}
          />
        ))}
      </div>

      <Button onClick={save} disabled={saving} className="rounded-xl h-11 merc-button font-bold gap-2 text-sm">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
        Save & place in venue
      </Button>
    </div>
  );
}