import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import PortalStageViewer from '@/components/live/PortalStageViewer';
import WelcomePanelToggle from '@/components/live/venues/WelcomePanelToggle';
import VenueTemplatesTab from '@/components/live/venues/VenueTemplatesTab';
import VenueIdlePlaylistTab from '@/components/live/venues/VenueIdlePlaylistTab';
import VenueVisibilityCard from '@/components/live/venues/VenueVisibilityCard';
import VenueBrandingCard from '@/components/live/venues/VenueBrandingCard';
import VenueAccessGateCard from '@/components/live/venues/VenueAccessGateCard';
import VenueStaffCard from '@/components/live/venues/VenueStaffCard';
import { buildPortalShareUrl } from '@/lib/live/portalEmbedUrl';

export default function LiveVenueDetail() {
  const { venueId } = useParams();
  const [venue, setVenue] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const load = () => {
    base44.entities.PortalVenue.filter({ id: venueId })
      .then((rows) => {
        if (rows[0]) setVenue(rows[0]);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  };

  useEffect(load, [venueId]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-bold text-foreground">Venue not found</p>
          <Button asChild variant="outline" className="rounded-xl mt-4">
            <Link to="/live-venues">Back to venues</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const shareUrl = buildPortalShareUrl(venue.room_id);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <Link to="/live-venues" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> All venues
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-4xl font-display truncate">{venue.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{venue.description || 'No description yet'}</p>
          </div>
          {venue.ownership === 'creator' && (
            <Badge className="gap-1 text-[10px] flex-shrink-0">
              <ShieldCheck className="w-3 h-3" /> Creator-owned
            </Badge>
          )}
        </div>

        <div className="h-[420px] max-h-[60vh]">
          <PortalStageViewer roomId={venue.room_id} guardian />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Venue link copied'); }}
            className="rounded-xl h-10 gap-2 text-sm">
            <Copy className="w-4 h-4" /> Copy Fan Link
          </Button>
          <Button variant="outline" asChild className="rounded-xl h-10 gap-2 text-sm">
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" /> Open Full Screen
            </a>
          </Button>
        </div>

        <VenueBrandingCard venue={venue} onUpdated={load} />

        <VenueVisibilityCard venue={venue} onUpdated={load} />

        <VenueAccessGateCard venue={venue} onUpdated={load} />

        <VenueIdlePlaylistTab venue={venue} onUpdated={load} />

        <VenueStaffCard venue={venue} onUpdated={load} />

        <VenueTemplatesTab venue={venue} onUpdated={load} />

        <WelcomePanelToggle venue={venue} onUpdated={load} />
      </div>
    </div>
  );
}