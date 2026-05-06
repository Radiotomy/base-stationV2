import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Users, Clock, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import { useLiveEventBus } from '@/hooks/useLiveEventBus';
import LiveChatPanel from '@/components/live/LiveChatPanel';
import LiveReactionBar from '@/components/live/LiveReactionBar';
import PortalStageViewer from '@/components/live/PortalStageViewer';
import NowPlayingDisplay from '@/components/live/NowPlayingDisplay';
import ParticipantList from '@/components/live/ParticipantList';
import EventFeed from '@/components/live/EventFeed';
import FanIdentityPanel from '@/components/live/FanIdentityPanel';
import LiveVisualizer from '@/components/live/LiveVisualizer';
import LiveQuestPanel from '@/components/live/LiveQuestPanel';
import LiveDropOverlay from '@/components/live/LiveDropOverlay';
import TipModal from '@/components/tipping/TipModal';
import { toast } from 'sonner';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LiveWatch() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('roomId');

  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Event bus — audience listens
  const { publishEvent } = useLiveEventBus(roomId, (evt) => {
    setRecentEvents((prev) => [...prev.slice(-19), evt]);
  });

  // Load session
  useEffect(() => {
    if (!roomId) { setLoading(false); return; }
    base44.entities.LiveSession.filter({ id: roomId })
      .then(results => {
        if (results[0]) {
          const s = results[0];
          setSession(s);
          setParticipants(s?.state?.participants || []);
          setNowPlaying(s?.state?.nowPlaying || null);
          setRecentEvents(s?.state?.recentEvents || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [roomId]);

  // Subscribe to live session updates
  useEffect(() => {
    if (!roomId) return;
    const unsub = base44.entities.LiveSession.subscribe(evt => {
      if (evt.data?.id === roomId) {
        const s = evt.data;
        setSession(s);
        setParticipants(s?.state?.participants || []);
        setNowPlaying(s?.state?.nowPlaying || null);
        setRecentEvents(s?.state?.recentEvents || []);
      }
    });
    return unsub;
  }, [roomId]);

  // Join as fan once when session is streaming
  useEffect(() => {
    if (!session || !currentUser || hasJoinedRef.current) return;
    if (session.status !== 'streaming') return;
    hasJoinedRef.current = true;

    base44.entities.LiveSession.update(roomId, {
      viewer_count: (session.viewer_count || 0) + 1,
    }).catch(() => {});

    publishEvent('join', {
      userId: currentUser.id,
      displayName: currentUser.full_name || 'Fan',
      type: 'fan',
    });

    // Award attendance XP (capped server-side)
    base44.functions.invoke('awardLiveXP', { sessionId: roomId, kind: 'attend' })
      .then(r => {
        if (r.data?.awarded > 0) toast.success(`+${r.data.awarded} XP for joining!`, { icon: '⚡' });
        if (r.data?.new_badges?.length) {
          r.data.new_badges.forEach(b => toast.success(`🏆 Badge unlocked: ${b.replace(/_/g, ' ')}`));
        }
      })
      .catch(() => {});

    const alreadyIn = (session?.state?.participants || []).some(p => p.id === currentUser.id);
    if (!alreadyIn) {
      const updated = [
        ...(session?.state?.participants || []),
        { id: currentUser.id, displayName: currentUser.full_name || 'Fan', type: 'fan', avatarUrl: '' },
      ];
      base44.entities.LiveSession.update(roomId, {
        state: { ...(session?.state || {}), participants: updated },
      }).catch(() => {});
    }

    return () => {
      base44.entities.LiveSession.update(roomId, {
        viewer_count: Math.max(0, (session.viewer_count || 1) - 1),
      }).catch(() => {});
      publishEvent('leave', { userId: currentUser?.id, type: 'fan' });
    };
  }, [session?.status, currentUser?.id]);

  // Elapsed timer
  useEffect(() => {
    if (!session?.start_time || session.status !== 'streaming') return;
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000);
      setElapsed(Math.max(0, diff));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.start_time, session?.status]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
    </div>
  );

  if (!roomId || !session) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-center px-6">
      <div>
        <Radio className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-black text-foreground mb-2">Session Not Found</h2>
        <p className="text-muted-foreground text-sm mb-6">This live session doesn't exist or has ended.</p>
        <Link to="/live-studio" className="text-purple-400 hover:text-purple-300 text-sm font-semibold">← Go to Live Studio</Link>
      </div>
    </div>
  );

  const isLive = session.status === 'streaming';
  const isEnded = session.status === 'completed' || session.status === 'archived';

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-foreground truncate">{session.title}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isLive && (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-400">LIVE</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />{formatDuration(elapsed)}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />{session.viewer_count || 0}
              </div>
            </>
          )}
          {isEnded && <Badge variant="outline" className="text-xs text-muted-foreground">Session Ended</Badge>}
        </div>
      </div>

      <div className="pt-14 min-h-screen flex flex-col">

        {/* Phase 4 — Live Visualizer (additive overlay above stage on small screens) */}
        {session.active_visualizer_preset_id && !session.portal_room_id && !session.portals_room_id && (
          <div className="px-4 pt-4">
            <LiveVisualizer
              style={session.active_visualizer_preset_id}
              isPlaying={!!nowPlaying?.isPlaying}
              recentReactions={recentEvents.filter(e => e.type === 'reaction').length}
            />
          </div>
        )}

        {/* Portal 3D stage or gradient fallback */}
        {session.portal_room_id ? (
          <div className="h-[55vh] w-full px-4 pt-4">
            <PortalStageViewer roomId={session.portal_room_id} />
          </div>
        ) : (
          <div className="relative bg-gradient-to-br from-red-950 via-black to-purple-950 py-14 px-6 flex flex-col items-center justify-center text-center">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-red-600 blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-purple-600 blur-3xl" />
            </div>
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-700 to-purple-800 border-4 border-red-500/30 flex items-center justify-center mb-4 shadow-2xl">
              <Radio className={`w-8 h-8 text-white/70 ${isLive ? 'animate-pulse' : ''}`} />
            </div>
            {session.description && (
              <p className="text-white/40 text-sm max-w-sm relative">{session.description}</p>
            )}
          </div>
        )}

        {/* Now Playing strip */}
        <div className="px-4 py-3 bg-card/60 border-b border-border/40">
          <NowPlayingDisplay nowPlaying={nowPlaying} isLive={isLive} />
        </div>

        {/* Main content grid */}
        <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <FanIdentityPanel
                currentUser={currentUser}
                performerId={session.user_id}
                performerName={session.current_track_artist || session.title}
                performerEmail={session.user_email}
                onTipClick={() => setShowTipModal(true)}
              />
              <LiveReactionBar sessionId={roomId} currentUser={currentUser} isLive={isLive} />
              <ParticipantList participants={participants} />

              {/* Phase 4 — Fan Quests */}
              <LiveQuestPanel sessionId={roomId} isPerformer={false} currentUserId={currentUser?.id} />

              {/* Event feed */}
              <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse inline-block" />
                  Event Bus
                </p>
                <EventFeed events={recentEvents} />
              </div>
            </div>

            {/* Chat */}
            <div className="lg:col-span-2 h-[420px]">
              <LiveChatPanel sessionId={roomId} currentUser={currentUser} isLive={isLive} />
            </div>
          </div>
        </div>
      </div>

      {/* Phase 5 — Live drop overlay */}
      <LiveDropOverlay recentEvents={recentEvents} sessionId={roomId} currentUser={currentUser} />

      {showTipModal && (
        <TipModal
          artist={{
            id: session.user_id,
            name: session.current_track_artist || session.title || 'Performer',
            email: session.user_email,
          }}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </div>
  );
}