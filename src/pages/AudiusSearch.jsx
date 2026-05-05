import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Search, Headphones } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AudiusTrackCard from '@/components/audius/AudiusTrackCard';

export default function AudiusSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const r = await base44.functions.invoke('searchAudius', { query: query.trim(), limit: 30 });
      setResults(r.data?.data || r.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10">
        <Link to="/audius-trending" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Trending
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Headphones className="w-6 h-6 text-emerald-400" />
            <Search className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground mb-2">Search Audius</h1>
          <p className="text-muted-foreground">Find tracks across the entire Audius network.</p>
        </div>

        <div className="flex gap-2 mb-6">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search tracks, artists, genres…"
            className="rounded-xl"
          />
          <Button onClick={handleSearch} disabled={loading || !query.trim()} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 gap-2">
            <Search className="w-4 h-4" /> Search
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : !searched ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Try a search above.</div>
        ) : results.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl text-muted-foreground text-sm">
            No results for "{query}".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.map(track => <AudiusTrackCard key={track.id} track={track} />)}
          </div>
        )}
      </div>
    </div>
  );
}