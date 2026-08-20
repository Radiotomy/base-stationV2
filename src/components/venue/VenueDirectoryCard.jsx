import { Link } from 'react-router-dom';
import { Radio, Music, Video, Box, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * One room in the public venue directory. Shows what is on air right now, so a
 * fan choosing between rooms is choosing between sounds rather than names.
 */
export default function VenueDirectoryCard({ venue }) {
  const onAir = venue.now_playing;
  const art = onAir?.thumbnail_url || venue.cover_image_url;
  const MediaIcon = onAir?.media_kind === 'video' ? Video : Music;

  return (
    <Link
      to={`/venue/${venue.id}`}
      className="merc-card merc-card-hover rounded-3xl overflow-hidden block transition-all"
    >
      <div className="aspect-video bg-muted/30 relative overflow-hidden">
        {art ? (
          <img src={art} alt={venue.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Box className="w-8 h-8 text-muted-foreground opacity-30" />
          </div>
        )}
        {venue.is_live && (
          <Badge className="absolute top-3 left-3 gap-1.5 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" /> LIVE
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-2">
        <p className="font-display text-lg truncate">{venue.name}</p>

        {venue.members_only ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 flex-shrink-0" /> Fan club members only
          </p>
        ) : venue.is_live ? (
          <p className="text-xs text-accent flex items-center gap-1.5 truncate">
            <Radio className="w-3.5 h-3.5 flex-shrink-0" />
            {venue.live_title || 'Live performance in progress'}
          </p>
        ) : onAir ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <MediaIcon className="w-3.5 h-3.5 flex-shrink-0" />
            {onAir.title || 'On air'}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Room open — nothing on air</p>
        )}

        {venue.channel_title && !venue.is_live && (
          <p className="text-[11px] text-muted-foreground/70 truncate">{venue.channel_title}</p>
        )}
      </div>
    </Link>
  );
}