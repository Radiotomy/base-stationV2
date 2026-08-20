import { useState } from 'react';
import { DoorOpen, Heart, Loader2, KeyRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

const GATES = [
  {
    value: 'open',
    label: 'Open to everyone',
    icon: DoorOpen,
    detail: 'Anyone who finds the venue can listen and enter the room.',
  },
  {
    value: 'fan_club',
    label: 'Fan club members only',
    icon: Heart,
    detail: 'Only active members get the programme and the room link. Others see a join prompt.',
  },
];

/**
 * The venue door. Two independent locks, kept visually separate because they are
 * enforced in different places: BASE Station can gate its own surfaces, but only
 * Portals can stop someone who already has the raw room URL.
 */
export default function VenueAccessGateCard({ venue, onUpdated }) {
  const [saving, setSaving] = useState('');
  const [tokenSaving, setTokenSaving] = useState(false);
  const current = venue.access_gate || 'open';
  const tokenGated = !!venue.settings_snapshot?.onlyNftHolders;

  const setGate = async (value) => {
    if (value === current) return;
    setSaving(value);
    try {
      await base44.entities.PortalVenue.update(venue.id, { access_gate: value });
      toast.success(value === 'open' ? 'Venue is open to everyone' : 'Venue is now members only');
      onUpdated?.();
    } catch {
      toast.error('Could not update access');
    } finally {
      setSaving('');
    }
  };

  const setTokenGate = async (next) => {
    setTokenSaving(true);
    try {
      await base44.functions.invoke('updatePortalRoomSettings', {
        venueId: venue.id,
        settings: { onlyNftHolders: next },
      });
      toast.success(next ? 'Room door is token gated' : 'Room door opened');
      onUpdated?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not update the room door');
    } finally {
      setTokenSaving(false);
    }
  };

  return (
    <div className="merc-card rounded-3xl p-5 space-y-5">
      <div>
        <p className="font-display text-lg">Who can get in</p>
        <p className="text-xs text-muted-foreground mt-1">
          Applies after someone has found the venue.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {GATES.map(({ value, label, icon: Icon, detail }) => {
          const active = current === value;
          return (
            <button
              key={value}
              onClick={() => setGate(value)}
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

      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-muted-foreground" /> Token gate the 3D door
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            Portals checks NFT holdings at the room entrance itself, so it also
            stops anyone who has the raw Portals link.
          </p>
        </div>
        {tokenSaving
          ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 mt-1" />
          : <Switch checked={tokenGated} onCheckedChange={setTokenGate} className="flex-shrink-0 mt-1" />}
      </div>
    </div>
  );
}