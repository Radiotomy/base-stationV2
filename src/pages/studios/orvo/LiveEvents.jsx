import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft } from 'lucide-react';
import ScheduleEventForm from '@/components/studios/orvo/live/ScheduleEventForm';
import LiveEventCard from '@/components/studios/orvo/live/LiveEventCard';

export default function LiveEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ev, pods] = await Promise.all([
        base44.entities.OrvoLiveEvent.list('-scheduled_at', 50),
        user ? base44.entities.Podcast.filter({ user_id: user.id }) : Promise.resolve([]),
      ]);
      if (!alive) return;
      setEvents(ev || []);
      setPodcasts(pods || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const live = events.filter((e) => e.status === 'live');
  const upcoming = events.filter((e) => e.status === 'scheduled');
  const past = events.filter((e) => e.status === 'ended' || e.status === 'cancelled');

  const Section = ({ title, items }) => items.length > 0 && (
    <div className="mb-8">
      <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">{title}</p>
      <div className="space-y-3">{items.map((e) => <LiveEventCard key={e.id} event={e} />)}</div>
    </div>
  );

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#14100C' }}>
      <div className="max-w-3xl mx-auto px-6 pt-14">
        <Link to="/studios/orvo" className="text-sm text-white/50 hover:text-[#FF9A4D] flex items-center gap-1 mb-6">
          <ArrowLeft className="w-4 h-4" /> ORVO Studio
        </Link>
        <h1 className="font-display text-3xl text-white mb-1">Live Sessions</h1>
        <p className="text-sm text-white/50 mb-8">Broadcast a live episode with an AI co-host on the mic beside you.</p>

        {podcasts.length > 0 && (
          <div className="mb-10">
            <ScheduleEventForm podcasts={podcasts} onScheduled={(e) => setEvents((prev) => [e, ...prev])} />
          </div>
        )}

        {loading ? (
          <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin mx-auto" />
        ) : (
          <>
            <Section title="On air now" items={live} />
            <Section title="Upcoming" items={upcoming} />
            <Section title="Past sessions" items={past} />
            {events.length === 0 && <p className="text-sm text-white/40">No live sessions yet.</p>}
          </>
        )}
      </div>
    </div>
  );
}