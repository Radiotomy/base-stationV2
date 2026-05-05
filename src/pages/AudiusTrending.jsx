import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Headphones, TrendingUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AudiusTrackCard from '@/components/audius/AudiusTrackCard';

const TIME_OPTIONS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'allTime', label: 'All Time' },
];

export default function AudiusTrending() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState('week');
  const [genre, setGenre] = useState('');

  useEffect(() => {
    setLoading(true);
    base44.functions.invoke('getAudiusTrending', { time, genre: genre || undefined })
      .then(r => setTracks(r.data?.data || r.data || []))
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [time, genre]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <Link to="/audius-search">
            <Button variant="outline" className="rounded-xl gap-2">
              <Search className="w-4 h-4" /> Search Audius
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Headphones className="w-6 h-6 text-emerald-400" />
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground mb-2">Audius Trending</h1>
          <p className="text-muted-foreground">Discover what's hot across the OpenAudio Protocol.</p>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {TIME_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setTime(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${time === opt.value ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <Headphones className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground text-sm">No trending tracks available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tracks.slice(0, 50).map(track => (
              <AudiusTrackCard key={track.id} track={track} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}