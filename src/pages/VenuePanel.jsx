import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import VenueEmbedPanel from '@/components/live/venues/VenueEmbedPanel';
import VenueRoomAudioControls from '@/components/live/venues/VenueRoomAudioControls';
import VenueListenAlong from '@/components/live/venues/VenueListenAlong';
import { useVenueNowPlaying } from '@/hooks/useVenueNowPlaying';

/**
 * Rendered INSIDE the Portals 3D venue through the room's welcome iframe.
 *
 * Public and unauthenticated by design: every fan in the room loads it, and most
 * are not signed in to BASE Station. It resolves the room's own state server-side
 * — a live performance if one is running, otherwise the venue's idle programme —
 * so the panel and the stage wall always name the same thing.
 *
 * It also nudges the stage forward when the programme advances. The scheduled
 * sweep can only run every five minutes, which is longer than most tracks, so the
 * surface that fans are actually looking at is what keeps the wall honest.
 */
export default function VenuePanel() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('roomId');
  const fallbackName = params.get('name') || 'BASE Station';

  const { state } = useVenueNowPlaying({ roomId });
  const pushedForRef = useRef('');

  const item = state?.now_playing?.item;
  const venueId = state?.venue?.id;

  useEffect(() => {
    if (!venueId || !item?.asset_id || state?.is_live) return;
    if (pushedForRef.current === item.asset_id) return;
    pushedForRef.current = item.asset_id;
    // Best-effort: the push is a no-op when the wall already matches, so a
    // failure here costs the room nothing but a slightly stale screen.
    base44.functions.invoke('advanceVenueStages', { venueId }).catch(() => {});
  }, [venueId, item?.asset_id, state?.is_live]);

  const track = state?.is_live
    ? { title: state.live?.track_title || state.live?.title, artist: state.live?.track_artist }
    : item
      ? { title: item.title, artist: state?.channel?.title || 'Always-on channel' }
      : null;

  return (
    <VenueEmbedPanel
      venueName={state?.venue?.name || fallbackName}
      track={track}
      // Transport only makes sense for the venue's own programme — a live show's
      // audio is driven by the performer, not by a room object.
      audioControls={venueId && !state?.is_live ? (
        <>
        {item?.file_url && item.media_kind !== 'video' && !state?.venue?.idle_paused && (
          <VenueListenAlong
            url={item.file_url}
            offsetSeconds={state?.now_playing?.offset_seconds || 0}
            volume={typeof state?.venue?.idle_volume === 'number' ? state.venue.idle_volume : 0.8}
          />
        )}
        <VenueRoomAudioControls
          venueId={venueId}
          volume={typeof state?.venue?.idle_volume === 'number' ? state.venue.idle_volume : 0.8}
          paused={!!state?.venue?.idle_paused}
        />
        </>
      ) : null}
    />
  );
}