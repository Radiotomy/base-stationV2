import { Link } from 'react-router-dom';
import { Users, Video, Headphones } from 'lucide-react';

/** Horizontal strip of sessions currently on air across the community. */
export default function LiveNowStrip({ events }) {
  if (!events?.length) return null;

  return (
    <div className="mb-10">
      <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> On air now
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {events.map((e) => (
          <Link key={e.id} to={`/studios/orvo/live/${e.id}`} className="merc-card merc-card-hover rounded-xl p-4 min-w-[240px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-1.5 text-[10px] font-black uppercase text-[#FF9A4D]">
              {e.media_type === 'video' ? <Video className="w-3 h-3" /> : <Headphones className="w-3 h-3" />}
              {e.media_type === 'video' ? 'Video' : 'Audio'} broadcast
            </div>
            <p className="text-sm font-bold text-white truncate">{e.title}</p>
            <p className="text-xs text-white/45 flex items-center gap-1 mt-1"><Users className="w-3 h-3" />{e.listener_count || 0} watching</p>
          </Link>
        ))}
      </div>
    </div>
  );
}