import { Link } from 'react-router-dom';
import { Box, ExternalLink, Copy, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { buildPortalShareUrl } from '@/lib/live/portalEmbedUrl';

export default function VenueCard({ venue }) {
  const shareUrl = buildPortalShareUrl(venue.room_id);
  const creating = venue.status === 'creating';
  const failed = venue.status === 'failed';

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Venue link copied');
  };

  return (
    <div className="merc-card merc-card-hover rounded-2xl overflow-hidden transition-all">
      <div className="relative h-32 bg-muted/30">
        {venue.cover_image_url ? (
          <img src={venue.cover_image_url} alt={venue.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Box className="w-8 h-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1.5">
          {venue.ownership === 'creator' && (
            <Badge className="bg-black/70 text-[10px] gap-1 border-0">
              <ShieldCheck className="w-3 h-3" /> Creator-owned
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="min-w-0">
          <h3 className="font-bold text-foreground truncate">{venue.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {venue.description || 'No description yet'}
          </p>
        </div>

        {creating && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Building your world…
          </div>
        )}

        {failed && (
          <div className="flex items-start gap-2 text-xs text-destructive">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{venue.error_message || 'Venue creation failed'}</span>
          </div>
        )}

        {venue.room_id && !failed && (
          <div className="flex gap-2">
            <Button size="sm" asChild className="flex-1 rounded-lg h-8 text-xs font-bold">
              <Link to={`/live-venues/${venue.id}`}>Manage</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={copyLink} className="rounded-lg h-8 w-8 p-0">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" asChild className="rounded-lg h-8 w-8 p-0">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}