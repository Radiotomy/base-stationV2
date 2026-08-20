import { Link } from 'react-router-dom';
import { Lock, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shown when a fan reaches a members-only venue without an active membership.
 * The venue's name and art are still visible — this is an invitation, not a wall.
 */
export default function VenueGateCard({ venue, creatorId, isSignedIn }) {
  return (
    <div className="merc-card rounded-3xl overflow-hidden">
      {venue.cover_image_url && (
        <div className="aspect-video overflow-hidden opacity-40">
          <img src={venue.cover_image_url} alt={venue.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-8 text-center space-y-4">
        <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
        <div>
          <p className="text-lg font-display">Members only</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            This room is open to the artist's fan club. Join to hear the programme
            and step inside the 3D venue.
          </p>
        </div>
        {isSignedIn ? (
          <Button asChild className="rounded-xl merc-button font-bold gap-2">
            <Link to={`/fanclub/${creatorId}`}>
              <Heart className="w-4 h-4" /> Join the fan club
            </Link>
          </Button>
        ) : (
          <Button asChild className="rounded-xl merc-button font-bold">
            <Link to="/login">Sign in to continue</Link>
          </Button>
        )}
      </div>
    </div>
  );
}