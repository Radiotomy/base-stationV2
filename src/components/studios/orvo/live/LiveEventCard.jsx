import { Link } from 'react-router-dom';
import { Radio, Users, Calendar } from 'lucide-react';

const STATUS = {
  live: 'bg-red-500/15 text-red-300 border-red-500/40',
  scheduled: 'bg-white/10 text-white/50 border-white/15',
  ended: 'bg-white/5 text-white/30 border-white/10',
  cancelled: 'bg-white/5 text-white/30 border-white/10',
};

export default function LiveEventCard({ event }) {
  return (
    <Link to={`/studios/orvo/live/${event.id}`} className="merc-card merc-card-hover rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${STATUS[event.status] || STATUS.scheduled}`}>
            {event.status === 'live' ? 'Live now' : event.status}
          </span>
          {event.is_ai_hosted && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FF9A4D]/15 text-[#FF9A4D] border border-[#FF9A4D]/30">AI co-host</span>
          )}
        </div>
        <p className="text-white font-bold truncate">{event.title}</p>
        <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
          <Calendar className="w-3 h-3" />
          {event.scheduled_at ? new Date(event.scheduled_at).toLocaleString() : '—'}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        {event.status === 'live' ? (
          <p className="text-sm text-white/60 flex items-center gap-1 justify-end"><Users className="w-4 h-4" />{event.listener_count || 0}</p>
        ) : (
          <Radio className="w-5 h-5 text-white/20 ml-auto" />
        )}
      </div>
    </Link>
  );
}