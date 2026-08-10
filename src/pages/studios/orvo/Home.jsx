import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Mic, Compass, Upload, Star } from 'lucide-react';
import PodcastCard from '@/components/studios/orvo/PodcastCard';

export default function Home() {
  const { user } = useAuth();
  const [myPodcasts, setMyPodcasts] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.allSettled([
      base44.entities.Podcast.filter({ user_id: user.id }, '-created_date', 50),
      base44.entities.Podcast.filter({ is_active: true }, '-created_date', 24),
    ]).then(([mine, pub]) => {
      if (!alive) return;
      if (mine.status === 'fulfilled') setMyPodcasts(mine.value || []);
      if (pub.status === 'fulfilled') setDiscover(pub.value || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user]);

  const featured = discover.find((p) => p.is_featured);
  const discoverList = discover.filter((p) => p.user_id !== user?.id);

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#14100C' }}>
      {/* Hero */}
      <div className="pt-16 pb-10 px-6">
        <div className="max-w-6xl mx-auto">
          <span className="inline-block mb-4 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full bg-[#FF9A4D]/10 text-[#FF9A4D] border border-[#FF9A4D]/30">
            🎙️ ORVO Studio
          </span>
          <h1 className="font-display text-4xl md:text-5xl text-white mb-3">
            Your <span className="text-iridescent">AI-Native</span> Podcast Studio
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mb-6">
            Create shows, publish episodes to IPFS, and — soon — voice entire episodes with AI hosts and guests.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/studios/orvo/create-podcast" className="merc-button rounded-full px-6 py-2.5 text-sm font-black flex items-center gap-2">
              <Mic className="w-4 h-4" /> Start a Podcast
            </Link>
            <a href="#discover" className="merc-button-dark rounded-full px-6 py-2.5 text-sm font-bold flex items-center gap-2">
              <Compass className="w-4 h-4" /> Browse Podcasts
            </a>
            {myPodcasts.length > 0 && (
              <Link to="/studios/orvo/upload" className="merc-button-dark rounded-full px-6 py-2.5 text-sm font-bold flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload Episode
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 space-y-10">
        {/* Featured banner */}
        {featured && (
          <Link
            to={`/studios/orvo/podcast/${featured.id}`}
            className="merc-card merc-card-hover rounded-2xl p-5 flex items-center gap-4 block transition-all"
          >
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/40 flex-shrink-0">
              {featured.cover_image && <img src={featured.cover_image} alt={featured.title} className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#FF9A4D] flex items-center gap-1">
                <Star className="w-3 h-3" /> Featured
              </p>
              <p className="font-display text-lg text-white truncate">{featured.title}</p>
              <p className="text-sm text-white/50 truncate">{featured.description}</p>
            </div>
          </Link>
        )}

        {/* My Podcasts */}
        <section>
          <h2 className="font-display text-2xl text-white mb-4">My Podcasts</h2>
          {loading ? (
            <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
          ) : myPodcasts.length === 0 ? (
            <div className="merc-card rounded-2xl p-8 text-center">
              <Mic className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/60 mb-4">You haven't started a podcast yet.</p>
              <Link to="/studios/orvo/create-podcast" className="merc-button rounded-full px-6 py-2 text-sm font-black inline-block">
                Start a Podcast
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {myPodcasts.map((p) => (
                <PodcastCard key={p.id} podcast={p} isOwner />
              ))}
            </div>
          )}
        </section>

        {/* Discover */}
        <section id="discover">
          <h2 className="font-display text-2xl text-white mb-4">Discover</h2>
          {discoverList.length === 0 ? (
            <p className="text-white/40 text-sm">No published podcasts yet — be the first.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {discoverList.map((p) => (
                <PodcastCard key={p.id} podcast={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}