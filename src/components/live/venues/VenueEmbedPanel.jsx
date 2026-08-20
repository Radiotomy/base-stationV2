import { Music, ShieldCheck, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * The panel body rendered INSIDE the Portals venue (via the room's welcome
 * iframe). Kept deliberately compact and high-contrast: it is displayed on a
 * ~1024x683 surface inside a 3D world, often on a laptop screen, so it has to be
 * readable at a glance rather than a full dashboard.
 */
export default function VenueEmbedPanel({ venueName, track, audioControls = null }) {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Live at</p>
          <h1 className="text-2xl font-display truncate">{venueName || 'BASE Station'}</h1>
        </div>
        <Badge className="text-[10px] flex-shrink-0">BASE Station</Badge>
      </div>

      <div className="merc-card rounded-2xl p-4 flex items-center gap-4">
        {track?.thumbnail_url ? (
          <img src={track.thumbnail_url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-muted/40 flex items-center justify-center flex-shrink-0">
            <Music className="w-7 h-7 text-muted-foreground/50" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Now Playing</p>
          <p className="text-lg font-bold truncate">{track?.title || 'Waiting for the next track'}</p>
          {track?.artist && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artist}</p>
          )}
        </div>
      </div>

      {audioControls}

      <div className="grid grid-cols-2 gap-3">
        <div className="merc-card rounded-2xl p-4">
          <ShieldCheck className="w-4 h-4 text-muted-foreground mb-2" />
          <p className="text-sm font-bold">Verified Provenance</p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            Tracks played here carry a BASE Mark, so the artist stays credited.
          </p>
        </div>
        <div className="merc-card rounded-2xl p-4">
          <Coins className="w-4 h-4 text-muted-foreground mb-2" />
          <p className="text-sm font-bold">Support the Artist</p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            Tips go straight to the creator performing tonight.
          </p>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-auto">
        Powered by BASE Station · 3D venue hosted on Portals
      </p>
    </div>
  );
}