import { useState } from 'react';
import { Loader2, MonitorPlay } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Wires BASE Station's in-world panel to the venue.
 *
 * Portals renders a URL as an iframe inside the 3D room (auto-shown on entry and
 * re-openable from the room's "i" button). Pointing it at our own embed page puts
 * now-playing, provenance, the tip jar and quest progress *inside* the venue —
 * fans don't have to leave the world to see them.
 */
export default function WelcomePanelToggle({ venue, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const enabled = !!venue.welcome_embed_enabled;

  const toggle = async (next) => {
    setBusy(true);
    try {
      // Pass the room id + name in the URL: the panel is loaded by every fan in
      // the room, so it must work without reading the owner-only venue record.
      const embedUrl = next
        // Always the public live site: the builder preview's origin needs a
        // sign-in session and refuses to load inside Portals' iframe.
        ? `https://basestation.live/venue-panel?roomId=${encodeURIComponent(venue.room_id)}&name=${encodeURIComponent(venue.name)}`
        : '';
      await base44.functions.invoke('updatePortalRoomSettings', {
        venueId: venue.id,
        settings: {
          welcomeEmbed: embedUrl,
          showWelcomeOnEntry: next,
          addWelcomeIframeToInfoButton: next,
        },
      });
      toast.success(next ? 'BASE Station panel is now live inside your venue' : 'In-world panel turned off');
      onUpdated?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  return (
    <div className="merc-card rounded-2xl p-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
          <MonitorPlay className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">In-World Panel</p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            Show now playing, provenance and the tip jar on a screen inside the venue. Fans can reopen it from the “i” button.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        <Switch checked={enabled} disabled={busy} onCheckedChange={toggle} />
      </div>
    </div>
  );
}