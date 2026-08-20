import { useState, useEffect } from 'react';
import { Loader2, Box, Radio } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import VenueDirectoryCard from '@/components/venue/VenueDirectoryCard';

/**
 * Public venue directory — where a fan discovers rooms without an account.
 *
 * Live rooms are separated from always-on rooms because they are different
 * invitations: one is happening now and will end, the other is there whenever.
 */
export default function Venues() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    base44.functions
      .invoke('listPublicVenues', {})
      .then((res) => { if (!cancelled) setVenues(res.data?.venues || []); })
      .catch(() => { if (!cancelled) setVenues([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const liveVenues = venues.filter((v) => v.is_live);
  const onDemand = venues.filter((v) => !v.is_live);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 space-y-10">
        <div>
          <h1 className="text-4xl sm:text-5xl font-display text-iridescent">Venues</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Step into a creator's 3D room. Some are live right now, the rest run
            always-on channels you can drop into any time.
          </p>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : venues.length === 0 ? (
          <div className="merc-card rounded-3xl p-12 text-center">
            <Box className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-bold text-foreground">No public venues yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Creators are still building. Check back soon.
            </p>
          </div>
        ) : (
          <>
            {liveVenues.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-display flex items-center gap-2">
                  <Radio className="w-4 h-4 text-accent" /> Live right now
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {liveVenues.map((v) => <VenueDirectoryCard key={v.id} venue={v} />)}
                </div>
              </section>
            )}

            {onDemand.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-display">Always-on rooms</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {onDemand.map((v) => <VenueDirectoryCard key={v.id} venue={v} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}