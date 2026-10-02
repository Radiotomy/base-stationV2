import { useParams, Link } from 'react-router-dom';
import { Loader2, Box, Radio, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';
import { useVenueNowPlaying } from '@/hooks/useVenueNowPlaying';
import VenueGateCard from '@/components/venue/VenueGateCard';
import VenueNowPlayingStage from '@/components/venue/VenueNowPlayingStage';
import VenueQueuePanel from '@/components/venue/VenueQueuePanel';
import VenueCoopChat from '@/components/venue/VenueCoopChat';
import { buildPortalShareUrl } from '@/lib/live/portalEmbedUrl';
import JoinRoomHowTo from '@/components/venue/JoinRoomHowTo';

/**
 * Public venue page — the reliable playback surface for a venue's programme.
 *
 * It exists because the 3D room can only show a stage wall: this page is where a
 * fan actually hears the music, on any device, without installing or entering
 * anything. It reads the same programme clock the room does, so the two agree.
 */
export default function VenueStage() {
  const { venueId } = useParams();
  const { state, loading, error } = useVenueNowPlaying({ venueId });
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <Radio className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="font-bold text-foreground">{error || 'Venue unavailable'}</p>
          <Button asChild variant="outline" className="rounded-xl mt-4">
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back to BASE Station</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { venue, is_live: isLive, live, now_playing: nowPlaying, channel, block_label: blockLabel, source } = state;

  // Members-only venue and this viewer is not a member — show the invitation
  // instead of the stage. The room link never reached the client at all.
  if (state.gated) {
    return (
      <div className="min-h-screen">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10 space-y-6">
          <h1 className="text-4xl sm:text-5xl font-display text-iridescent">{venue.name}</h1>
          {venue.description && (
            <p className="text-sm text-muted-foreground max-w-xl">{venue.description}</p>
          )}
          <VenueGateCard venue={venue} creatorId={state.creator_id} isSignedIn={!!user} />
        </div>
      </div>
    );
  }

  const roomUrl = venue.room_id ? buildPortalShareUrl(venue.room_id) : '';
  const sourceLabel = isLive
    ? 'Live now'
    : source === 'schedule'
      ? (blockLabel || 'Scheduled programme')
      : 'Always-on channel';

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 space-y-8">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-4xl sm:text-5xl font-display text-iridescent truncate">{venue.name}</h1>
            {venue.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">{venue.description}</p>
            )}
          </div>
          {isLive && (
            <Badge className="gap-1.5 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" /> LIVE
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {isLive ? (
              // A live show is transported through the room itself, so this page
              // points fans there instead of pretending to carry the stream.
              <div className="merc-card rounded-3xl p-8 text-center space-y-4">
                <Radio className="w-10 h-10 mx-auto text-accent animate-pulse" />
                <div>
                  <p className="text-lg font-display">{live?.title || 'Live performance in progress'}</p>
                  {live?.track_title && (
                    <p className="text-sm text-muted-foreground mt-1">Now playing: {live.track_title}</p>
                  )}
                </div>
                <Button asChild className="rounded-xl merc-button font-bold gap-2">
                  <Link to={`/live-watch?roomId=${live?.session_id || ''}`}>
                    <Radio className="w-4 h-4" /> Join the live show
                  </Link>
                </Button>
              </div>
            ) : (
              <VenueNowPlayingStage
                nowPlaying={nowPlaying}
                coverFallback={venue.cover_image_url}
                sourceLabel={sourceLabel}
              />
            )}

            {roomUrl && (
              <Button asChild className="w-full rounded-xl h-12 merc-button font-bold gap-2 text-sm">
                <a href={roomUrl} target="_blank" rel="noopener noreferrer">
                  <Box className="w-4 h-4" /> Enter the 3D room
                </a>
              </Button>
            )}
            {roomUrl && <JoinRoomHowTo />}
          </div>

          <div className="lg:col-span-1 space-y-5">
            <VenueQueuePanel channel={channel} nowPlaying={nowPlaying} />
            <VenueCoopChat venueId={venueId} user={user} />
          </div>
        </div>
      </div>
    </div>
  );
}