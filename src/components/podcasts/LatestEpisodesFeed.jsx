import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Play } from 'lucide-react';

function fmtDur(s) {
  if (!s) return '';
  return `${Math.floor(s / 60)} min`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Public cross-show feed of the most recently published episodes. */
export default function LatestEpisodesFeed({ podcasts = [] }) {
  const [episodes, setEpisodes] = useState([]);

  useEffect(() => {
    let alive = true;
    base44.entities.Episode.filter({ status: 'published' }, '-published_date', 8).then((eps) => {
      if (alive) setEpisodes(eps || []);
    });
    return () => { alive = false; };
  }, []);

  const podMap = useMemo(() => {
    const m = {};
    podcasts.forEach((p) => { m[p.id] = p; });
    return m;
  }, [podcasts]);

  if (episodes.length === 0) return null;

  return (
    <div className="mb-10">
      <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Latest episodes</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {episodes.map((ep) => {
          const pod = podMap[ep.podcast_id];
          const art = ep.thumbnail_url || pod?.cover_image;
          return (
            <Link
              key={ep.id}
              to={`/studios/orvo/episode/${ep.id}`}
              className="merc-card merc-card-hover rounded-xl p-3.5 flex items-center gap-3.5 transition-all group"
            >
              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-black/40 flex-shrink-0">
                {art && <img src={art} alt={ep.title} className="w-full h-full object-cover" />}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-5 h-5 text-white ml-0.5" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-white truncate group-hover:text-[#FF9A4D]">
                  {ep.episode_number ? `E${ep.episode_number} · ` : ''}{ep.title}
                </p>
                {pod && <p className="text-xs text-white/50 truncate">{pod.title}</p>}
                <p className="text-[11px] text-white/40">
                  {[fmtDate(ep.published_date), fmtDur(ep.duration_seconds)].filter(Boolean).join(' · ')}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}