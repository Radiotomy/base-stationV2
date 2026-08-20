import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Radio, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';
import VenuePlaylistCard from './VenuePlaylistCard';
import VenueScheduleEditor from './VenueScheduleEditor';

/**
 * Idle programming for a venue: what plays in the room when the artist is
 * offline. Owner-facing; the fan-facing side is /venue/:venueId and the in-room
 * welcome panel.
 */
export default function VenueIdlePlaylistTab({ venue, onUpdated }) {
  const [playlists, setPlaylists] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [p, s] = await Promise.all([
        base44.entities.VenuePlaylist.filter({ venue_id: venue.id }, '-created_date'),
        base44.entities.VenueSchedule.filter({ venue_id: venue.id }, '-created_date'),
      ]);
      setPlaylists(p || []);
      setSchedules(s || []);
    } catch {
      setPlaylists([]);
      setSchedules([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [venue.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const createPlaylist = async () => {
    setBusy(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.VenuePlaylist.create({
        venue_id: venue.id,
        user_id: user.id,
        user_email: user.email,
        title: playlists.length ? `Programme ${playlists.length + 1}` : 'Always-On Loop',
        items: [],
        // The first programme becomes the fallback loop, so a creator who only
        // ever builds one never has to discover the concept of a default.
        is_default_loop: playlists.length === 0,
        is_public: true,
        cycle_started_at: new Date().toISOString(),
      });
      await load();
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  const toggleIdle = async (next) => {
    setBusy(true);
    try {
      await base44.entities.PortalVenue.update(venue.id, { idle_enabled: next });
      onUpdated?.();
      if (next) {
        // Push immediately so the stage reflects the programme now rather than at
        // the next sweep — a creator turning this on expects to see it.
        base44.functions.invoke('advanceVenueStages', { venueId: venue.id }).catch(() => {});
        toast.success('Idle programming on — your venue keeps playing between shows');
      } else {
        base44.functions.invoke('advanceVenueStages', { venueId: venue.id }).catch(() => {});
        toast.success('Idle programming off — the venue shows its cover art');
      }
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  const pageUrl = `${window.location.origin}/venue/${venue.id}`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
              <Radio className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground text-sm">Idle programming</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Loops your tracks and videos in the venue whenever you're not live. A live show always takes over the stage, then the loop resumes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            <Switch checked={!!venue.idle_enabled} disabled={busy} onCheckedChange={toggleIdle} />
          </div>
        </div>

        {venue.idle_enabled && (
          <div className="flex gap-2 flex-wrap border-t border-border pt-3">
            <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs gap-1.5"
              onClick={() => { navigator.clipboard.writeText(pageUrl); toast.success('Venue page link copied'); }}>
              <Copy className="w-3.5 h-3.5" /> Copy venue page link
            </Button>
            <Button size="sm" variant="outline" asChild className="rounded-lg h-8 text-xs gap-1.5">
              <a href={pageUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Open venue page
              </a>
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {playlists.map((p) => (
            <VenuePlaylistCard key={p.id} playlist={p} siblings={playlists} onChanged={load} />
          ))}

          <Button variant="outline" onClick={createPlaylist} disabled={busy}
            className="w-full rounded-xl h-10 text-sm gap-2">
            <Plus className="w-4 h-4" /> New programme
          </Button>

          {playlists.length > 0 && (
            <VenueScheduleEditor venue={venue} playlists={playlists} schedules={schedules} onChanged={load} />
          )}
        </>
      )}
    </div>
  );
}