import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Headphones, Play, Download, ExternalLink, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AudiusTrack() {
  const { id } = useParams();
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    base44.functions.invoke('getAudiusTrack', { trackId: id })
      .then(r => setTrack(r.data?.data || r.data))
      .catch(() => setTrack(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const r = await base44.functions.invoke('importAudiusStems', { trackId: id });
      toast.success(`Imported ${r.data?.imported || 1} stem(s) to your library`, { icon: '📥' });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  if (!track) return (
    <div className="min-h-screen flex items-center justify-center text-center">
      <div>
        <Headphones className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Track not found.</p>
        <Link to="/audius-trending" className="text-emerald-400 text-sm mt-3 block">← Trending</Link>
      </div>
    </div>
  );

  const artwork = track.artwork?.['1000x1000'] || track.artwork?.['480x480'];
  const streamUrl = `https://discoveryprovider.audius.co/v1/tracks/${id}/stream?app_name=BaseStation`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">
        <Link to="/audius-trending" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {artwork ? (
            <img src={artwork} alt={track.title} className="w-full md:w-64 h-64 rounded-2xl object-cover shadow-2xl" />
          ) : (
            <div className="w-full md:w-64 h-64 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-900 flex items-center justify-center">
              <Headphones className="w-16 h-16 text-white/30" />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-0 mb-2 w-fit">Audius</Badge>
            <h1 className="text-3xl md:text-4xl font-black text-foreground mb-2">{track.title}</h1>
            {track.user && (
              <Link to={`/audius-artist/${track.user.id}`} className="flex items-center gap-2 text-muted-foreground hover:text-emerald-400 mb-3">
                <User className="w-4 h-4" />
                <span className="text-sm font-semibold">{track.user.name || track.user.handle}</span>
              </Link>
            )}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {track.genre && <Badge variant="outline">{track.genre}</Badge>}
              {track.mood && <Badge variant="outline">{track.mood}</Badge>}
              {track.play_count != null && <span className="text-xs text-muted-foreground">{track.play_count.toLocaleString()} plays</span>}
            </div>

            <audio controls src={streamUrl} className="w-full rounded-xl mb-3" />

            <div className="flex flex-wrap gap-2 mt-auto">
              <Button onClick={handleImport} disabled={importing} className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-500">
                <Download className="w-4 h-4" /> {importing ? 'Importing…' : 'Import to Library'}
              </Button>
              {track.permalink && (
                <a href={`https://audius.co${track.permalink}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="rounded-xl gap-2">
                    <ExternalLink className="w-4 h-4" /> Open on Audius
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        {track.description && (
          <div className="bg-card rounded-2xl border border-border p-5">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{track.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}