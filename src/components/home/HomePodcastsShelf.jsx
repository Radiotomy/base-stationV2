import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronRight, Mic } from 'lucide-react';

/** Site-home shelf surfacing the community podcast directory. */
export default function HomePodcastsShelf() {
  const [podcasts, setPodcasts] = useState([]);

  useEffect(() => {
    let alive = true;
    base44.entities.Podcast.filter({ is_active: true }, '-created_date', 6).then((pods) => {
      if (alive) setPodcasts(pods || []);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (podcasts.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#1C1712] to-[#0F0C09] p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-white text-xl md:text-2xl">Community Podcasts</h2>
        <Link
          to="/podcasts"
          className="text-[10px] font-black rounded-full px-3.5 py-1.5 flex items-center gap-1 text-[#2A1508]"
          style={{
            background: "linear-gradient(135deg, #FFB347 0%, #FF7A2F 100%)",
            boxShadow: "0 3px 10px -2px rgba(120,60,10,0.5)",
          }}
        >
          All Podcasts <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {podcasts.map((p) => (
          <Link
            key={p.id}
            to={`/studios/orvo/podcast/${p.id}`}
            className="group relative aspect-square rounded-lg overflow-hidden border border-black/70 bg-[#171310] block"
          >
            {p.cover_image ? (
              <img src={p.cover_image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Mic className="w-8 h-8 text-white/15" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white font-bold text-xs truncate">{p.title}</p>
              <p className="text-white/60 text-[10px] capitalize">{(p.category || 'other').replace('_', ' ')}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}