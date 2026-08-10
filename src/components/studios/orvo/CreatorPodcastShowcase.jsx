import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Mic, Play } from 'lucide-react';

/** Compact ORVO podcast showcase for a creator's public profile. */
export default function CreatorPodcastShowcase({ creatorId }) {
  const [podcasts, setPodcasts] = useState([]);
  const [episodes, setEpisodes] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const pods = await base44.entities.Podcast.filter({ user_id: creatorId, is_active: true }, '-created_date', 6);
      if (!alive) return;
      setPodcasts(pods || []);
      if (pods?.length) {
        const eps = await base44.entities.Episode.filter({ podcast_id: pods[0].id, status: 'published' }, '-published_date', 3);
        if (alive) setEpisodes(eps || []);
      }
    })();
    return () => { alive = false; };
  }, [creatorId]);

  if (podcasts.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-black text-foreground mb-5 flex items-center gap-2">
        <Mic className="w-5 h-5 text-orange-400" /> Podcasts
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        {podcasts.map((p) => (
          <Link key={p.id} to={`/studios/orvo/podcast/${p.id}`} className="rounded-2xl bg-card border border-border p-3 flex items-center gap-3 hover:border-orange-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted flex-shrink-0">
              {p.cover_image ? <img src={p.cover_image} alt={p.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Mic className="w-5 h-5 opacity-30" /></div>}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.episode_count || 0} episodes</p>
            </div>
          </Link>
        ))}
      </div>
      {episodes.length > 0 && (
        <div className="space-y-2">
          {episodes.map((e) => (
            <Link key={e.id} to={`/studios/orvo/episode/${e.id}`} className="flex items-center gap-3 rounded-xl bg-card border border-border px-4 py-2.5 hover:border-orange-500/40 transition-colors">
              <Play className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <p className="text-sm text-foreground truncate">{e.title}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}