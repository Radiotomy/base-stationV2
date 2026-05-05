import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Users, Clock, Music2, ArrowLeft, Volume2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import LiveChatPanel from '@/components/live/LiveChatPanel';
import LiveReactionBar from '@/components/live/LiveReactionBar';
import PortalStageViewer from '@/components/live/PortalStageViewer';

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
  const audioRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Load session
  useEffect(() => {
    if (!roomId) { setLoading(false); return; }
    base44.entities.LiveSession.filter({ id: roomId })
      .then(results => {
        if (results[0]) setSession(results[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [roomId]);

  // Subscribe to live session updates (track changes, viewer count, status)
  useEffect(() => {
    if (!roomId) return;
    const unsub = base44.entities.LiveSession.subscribe(evt => {
      if (evt.data?.id === roomId) {
        setSession(evt.data);
      }
    });
    return unsub;
  }, [roomId]);

  // Increment viewer count when joining
  useEffect(() => {
    if (!session || session.status !== 'streaming') return;
    base44.entities.LiveSession.update(roomId, {
      viewer_count: (session.viewer_count || 0) + 1,
    }).catch(() => {});
    return () => {
      // Decrement on leave
      base44.entities.LiveSession.update(roomId, {
        viewer_count: Math.max(0, (session.viewer_count || 1) - 1),
      }).catch(() => {});
    };
  }, [session?.id]);

  // Elapsed timer (from start_time)
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
        <Link to="/live-studio" className="text-purple-400 hover:text-purple-300 text-sm font-semibold">
          ← Go to Live Studio
        </Link>
      </div>
    </div>
  );

  const isLive = session.status === 'streaming';
  const isEnded = session.status === 'completed' || session.status === 'archived';

  // Get current track info from session metadata
  const trackTitle = session.current_track_title || null;
  const trackArtist = session.current_track_artist || null;

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
          {isEnded && (
            <Badge variant="outline" className="text-xs text-muted-foreground">Session Ended</Badge>
          )}
        </div>
      </div>

      {/* Main stage */}
      <div className="pt-14 min-h-screen flex flex-col">

        {/* Portal 3D stage (when available) OR fallback gradient stage */}
        {session.portal_room_id ? (
          <div className="h-[60vh] w-full px-4 pt-4">
            <PortalStageViewer roomId={session.portal_room_id} />
          </div>
        ) : (
          <div className="relative bg-gradient-to-br from-red-950 via-black to-purple-950 flex-shrink-0">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-red-600 blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-purple-600 blur-3xl" />
            </div>
            <div className="relative flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-red-700 to-purple-800 border-4 border-red-500/30 flex items-center justify-center mb-6 shadow-2xl shadow-red-900/50">
                {isLive ? (
                  <Volume2 className="w-10 h-10 text-white/70 animate-pulse" />
                ) : (
                  <Music2 className="w-10 h-10 text-white/30" />
                )}
              </div>
              {trackTitle ? (
                <div className="mb-4">
                  <p className="text-white font-black text-2xl mb-1">{trackTitle}</p>
                  {trackArtist && <p className="text-white/50 text-sm">{trackArtist}</p>}
                </div>
              ) : (
                <p className="text-white/40 text-sm mb-4">
                  {isLive ? 'Performer is live' : isEnded ? 'This session has ended' : 'Waiting for performer…'}
                </p>
              )}
              {session.description && (
                <p className="text-white/40 text-xs max-w-sm leading-relaxed">{session.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Now playing strip (shown alongside Portal) */}
        {session.portal_room_id && (trackTitle || isLive) && (
          <div className="px-4 py-2 bg-black/60 border-b border-border/40 flex items-center gap-3">
            {isLive && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
            {trackTitle && <p className="text-sm font-bold text-white truncate">{trackTitle}</p>}
            {trackArtist && <p className="text-xs text-white/50">{trackArtist}</p>}
          </div>
        )}

        {/* Reactions + Chat */}
        <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <LiveReactionBar sessionId={roomId} currentUser={currentUser} isLive={isLive} />
            </div>
            <div className="lg:col-span-2 h-[400px]">
              <LiveChatPanel sessionId={roomId} currentUser={currentUser} isLive={isLive} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}