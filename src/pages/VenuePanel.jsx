import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import VenueEmbedPanel from '@/components/live/venues/VenueEmbedPanel';

/**
 * Rendered INSIDE the Portals 3D venue through the room's welcome iframe.
 *
 * Public and unauthenticated by design: every fan in the room loads it, and most
 * of them are not signed in to BASE Station. It therefore reads only the live
 * session (publicly readable) and takes the venue name from the URL — the venue
 * record itself stays owner-only so a shared room link can never expose a
 * creator's venue settings.
 */
export default function VenuePanel() {
  const [track, setTrack] = useState(null);

  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('roomId');
  const venueName = params.get('name') || 'BASE Station';

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const sessions = await base44.entities.LiveSession.filter({ portal_room_id: roomId });
        const live = sessions.find((s) => s.status === 'streaming') || sessions[0];
        if (!cancelled && live) {
          setTrack({
            title: live.current_track_title || live.state?.nowPlaying?.title,
            artist: live.current_track_artist,
          });
        }
      } catch {
        // The panel must still render the venue shell if this read fails —
        // a blank screen inside the 3D world reads as a broken venue.
      }
    };

    load();
    // The panel lives inside a long-running 3D session, so it polls rather than
    // relying on a mount-time read that would go stale mid-show.
    const timer = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [roomId]);

  return <VenueEmbedPanel venueName={venueName} track={track} />;
}