import { useState, useEffect } from 'react';
import { Plus, Box, Loader2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import VenueCard from '@/components/live/venues/VenueCard';
import CreateVenueDialog from '@/components/live/venues/CreateVenueDialog';
import PortalsKeyPanel from '@/components/live/venues/PortalsKeyPanel';

export default function LiveVenues() {
  const [venues, setVenues] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => {
    base44.entities.PortalVenue.list('-created_date', 50)
      .then(setVenues)
      .catch(() => setVenues([]));
  };

  useEffect(load, []);

  const active = (venues || []).filter((v) => v.status !== 'archived');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-display">3D Venues</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Build a permanent 3D room for your live shows. Design it, brand it and share one link —
              your fans walk straight in from the browser.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-xl h-10 gap-2 font-bold">
              <Link to="/venue-architect"><Sparkles className="w-4 h-4" /> Build with AI</Link>
            </Button>
            <Button onClick={() => setCreating(true)} className="rounded-xl h-10 gap-2 font-bold">
              <Plus className="w-4 h-4" /> Create Venue
            </Button>
          </div>
        </div>

        <PortalsKeyPanel />

        {venues === null ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : active.length === 0 ? (
          <div className="merc-card rounded-2xl p-12 text-center">
            <Box className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-bold text-foreground">No venues yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first 3D venue and you'll have a stage, screens and a shareable door for your next show.
            </p>
            <Button onClick={() => setCreating(true)} className="rounded-xl h-10 gap-2 font-bold mt-5">
              <Plus className="w-4 h-4" /> Create Venue
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((v) => <VenueCard key={v.id} venue={v} />)}
          </div>
        )}
      </div>

      <CreateVenueDialog open={creating} onOpenChange={setCreating} onCreated={load} />
    </div>
  );
}