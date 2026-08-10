import { Link } from 'react-router-dom';
import { Mic, Headphones } from 'lucide-react';

const CATEGORY_LABELS = {
  music: 'Music', technology: 'Technology', culture: 'Culture', comedy: 'Comedy',
  news: 'News', education: 'Education', business: 'Business', arts: 'Arts',
  sports: 'Sports', health: 'Health', true_crime: 'True Crime', other: 'Other',
};

export default function PodcastCard({ podcast, isOwner = false }) {
  return (
    <Link
      to={`/studios/orvo/podcast/${podcast.id}`}
      className="merc-card merc-card-hover rounded-xl overflow-hidden block transition-all group"
    >
      <div className="aspect-square bg-black/40 relative overflow-hidden">
        {podcast.cover_image ? (
          <img
            src={podcast.cover_image}
            alt={podcast.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mic className="w-12 h-12 text-white/15" />
          </div>
        )}
        <span className="absolute top-2 left-2 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-black/70 text-[#FF9A4D] border border-[#FF9A4D]/30">
          {CATEGORY_LABELS[podcast.category] || 'Other'}
        </span>
      </div>
      <div className="p-3">
        <p className="font-bold text-sm text-white truncate">{podcast.title}</p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-white/50">
          <span>{podcast.episode_count || 0} episodes</span>
          <span className="flex items-center gap-1"><Headphones className="w-3 h-3" />{podcast.subscriber_count || 0}</span>
        </div>
        {isOwner && (
          <span className="inline-block mt-2 text-[11px] font-bold text-[#FF9A4D]">Open Studio →</span>
        )}
      </div>
    </Link>
  );
}