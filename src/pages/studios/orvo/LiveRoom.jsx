import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Users } from 'lucide-react';
import HostConsole from '@/components/studios/orvo/live/HostConsole';
import LiveTurnFeed from '@/components/studios/orvo/live/LiveTurnFeed';
import LiveStagePlayer from '@/components/studios/orvo/live/LiveStagePlayer';
import BroadcastConsole from '@/components/studios/orvo/live/BroadcastConsole';
import ListenerToolbar from '@/components/studios/orvo/live/ListenerToolbar';
import AutopilotConsole from '@/components/studios/orvo/live/AutopilotConsole';

export default function LiveRoom() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [turns, setTurns] = useState([]);
  const [loading, setLoading] = useState(true);

  const isHost = user && event && user.id === event.host_id;

  useEffect(() => {
    let alive = true;
    (async () => {
      const [evs, ts] = await Promise.all([
        base44.entities.OrvoLiveEvent.filter({ id }),
        base44.entities.OrvoLiveTurn.filter({ event_id: id }, 'created_date', 100),
      ]);
      if (!alive) return;
      setEvent(evs?.[0] || null);
      setTurns(ts || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  // Live updates: new co-host turns and listener/status changes
  useEffect(() => {
    const offTurns = base44.entities.OrvoLiveTurn.subscribe((e) => {
      if (e.type === 'create' && e.data?.event_id === id) {
        setTurns((prev) => (prev.some((t) => t.id === e.data.id) ? prev : [...prev, e.data]));
      }
    });
    const offEvent = base44.entities.OrvoLiveEvent.subscribe((e) => {
      if (e.data?.id === id) setEvent(e.data);
    });
    return () => { offTurns(); offEvent(); };
  }, [id]);

  // AI-cast heartbeat. The running order is derived from the show's start
  // instant, so anyone in the room can advance it and everyone lands on the same
  // answer — the scheduled sweep only covers a room with nobody in it.
  useEffect(() => {
    if (!event?.is_ai_cast || event.autopilot_status !== 'running') return;
    const tick = () => base44.functions.invoke('orvoAutopilotTick', { event_id: id }).catch(() => {});
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, [id, event?.is_ai_cast, event?.autopilot_status]);

  // Listener presence — count in on arrival, out on leave
  useEffect(() => {
    if (!event || event.status !== 'live' || isHost) return;
    base44.functions.invoke('orvoLiveEvent', { event_id: id, action: 'join' }).catch(() => {});
    return () => {
      base44.functions.invoke('orvoLiveEvent', { event_id: id, action: 'leave' }).catch(() => {});
    };
  }, [id, event?.status, isHost]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#14100C' }}>
        <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#14100C' }}>
        <div className="text-center">
          <p className="text-white/60 mb-4">Live session not found.</p>
          <Link to="/studios/orvo/live" className="merc-button rounded-full px-6 py-2 text-sm font-black">Back to live sessions</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#14100C' }}>
      <div className="max-w-3xl mx-auto px-6 pt-14">
        <Link to="/studios/orvo/live" className="text-sm text-white/50 hover:text-[#FF9A4D] flex items-center gap-1 mb-6">
          <ArrowLeft className="w-4 h-4" /> Live sessions
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {event.status === 'live' && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/40">Live now</span>
              )}
              {event.is_ai_cast ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FF9A4D]/15 text-[#FF9A4D] border border-[#FF9A4D]/30">AI cast</span>
              ) : event.is_ai_hosted && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FF9A4D]/15 text-[#FF9A4D] border border-[#FF9A4D]/30">AI co-host</span>
              )}
            </div>
            <h1 className="font-display text-2xl md:text-3xl text-white">{event.title}</h1>
          </div>
          <p className="text-sm text-white/50 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> {event.listener_count || 0} listening
          </p>
        </div>

        {/* An AI-cast show has no camera feed — the performance IS the turn
            stream, so the stage player would only ever show an empty frame. */}
        {!isHost && !event.is_ai_cast && (
          <div className="mb-4">
            <LiveStagePlayer event={event} />
          </div>
        )}

        <div className="mb-6">
          <ListenerToolbar event={event} user={user} />
        </div>

        {isHost && (
          <div className="space-y-4 mb-6">
            {event.is_ai_cast ? (
              <AutopilotConsole event={event} onChange={setEvent} />
            ) : (
              <>
                <BroadcastConsole event={event} onArchived={setEvent} />
                <HostConsole event={event} onStatusChange={setEvent} />
              </>
            )}
          </div>
        )}

        {event.status === 'scheduled' && !isHost && (
          <p className="text-sm text-white/50 mb-6">
            This session hasn't started yet — it begins {event.scheduled_at ? new Date(event.scheduled_at).toLocaleString() : 'soon'}.
          </p>
        )}

        <LiveTurnFeed turns={turns} autoPlay={event.status === 'live' && !isHost} />
      </div>
    </div>
  );
}