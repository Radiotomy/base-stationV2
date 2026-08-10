import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Mic } from 'lucide-react';
import PodcastCard from '@/components/studios/orvo/PodcastCard';
import PodcastDirectoryFilters from '@/components/studios/orvo/PodcastDirectoryFilters';
import LiveNowStrip from '@/components/studios/orvo/LiveNowStrip';

/** Public community directory of every published podcast on BASE Station. */
export default function Podcasts() {
  const [podcasts, setPodcasts] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [pods, live] = await Promise.all([
        base44.entities.Podcast.filter({ is_active: true }, '-created_date', 200),
        base44.entities.OrvoLiveEvent.filter({ status: 'live' }, '-scheduled_at', 20),
      ]);
      if (!alive) return;
      setPodcasts(pods || []);
      setLiveEvents(live || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return podcasts.filter((p) => {
      const matchesCat = category === 'all' || p.category === category;
      const matchesQ = !q || p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [podcasts, query, category]);

  const featured = filtered.filter((p) => p.is_featured);

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#14100C' }}>
      <div className="max-w-6xl mx-auto px-6 pt-14">
        <h1 className="font-display text-4xl text-white mb-2">Podcasts</h1>
        <p className="text-white/55 mb-8 max-w-2xl">
          Every show in the community — browse, listen, watch live broadcasts, and follow your favorites.
          <Link to="/studios/orvo" className="text-[#FF9A4D] hover:underline ml-1">Start your own →</Link>
        </p>

        <LiveNowStrip events={liveEvents} />

        <PodcastDirectoryFilters query={query} onQuery={setQuery} category={category} onCategory={setCategory} />

        {loading ? (
          <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin mx-auto" />
        ) : filtered.length === 0 ? (
          <div className="merc-card rounded-2xl p-10 text-center">
            <Mic className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-white/50">No podcasts match that search.</p>
          </div>
        ) : (
          <>
            {featured.length > 0 && category === 'all' && !query && (
              <div className="mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Featured shows</p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {featured.map((p) => <PodcastCard key={p.id} podcast={p} />)}
                </div>
              </div>
            )}
            <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">All shows</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filtered.map((p) => <PodcastCard key={p.id} podcast={p} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}