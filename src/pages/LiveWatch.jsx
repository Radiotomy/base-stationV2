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
import SessionEndedOverlay from '@/components/live/SessionEndedOverlay';
import FanVisualLayerSelector from '@/components/live/FanVisualLayerSelector';
import { useSyncPlayback } from '@/hooks/useSyncPlayback';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';
import { useStreamrAudio } from '@/hooks/useStreamrAudio';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
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

  // Fan-side visual layer preference (per-session, local state only).
  // Only meaningful when session.visual_layer === 'portals'.
  const [fanVisualPreference, setFanVisualPreference] = useState('standard');
  const portalsEntryMsRef = useRef(0); // wall-clock when fan entered 3D
  const analyticsCountedRef = useRef({ standard: false, portals: false });

  // Phase 5.7 — fan-side hidden audio element + sync playback hook
  const fanAudioRef = useRef(null);
  const { autoplayBlocked, resume, applyEvent, hydrate } = useSyncPlayback(fanAudioRef, { enabled: true });
  const audioData = useAudioAnalyzer(fanAudioRef, { enabled: true });
  const hasHydratedRef = useRef(false);
  const [showEndedOverlay, setShowEndedOverlay] = useState(false);

  // Phase 5.8 — fan-side Streamr subscriber
  const streamr = useStreamrAudio({ sessionId: roomId, role: 'subscriber' });
  const streamrStartedRef = useRef(false);
  const streamrToastShownRef = useRef(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Event bus — audience listens. Phase 5.7: also drive sync playback.
  const { publishEvent } = useLiveEventBus(roomId, (evt) => {
    setRecentEvents((prev) => [...prev.slice(-19), evt]);
    // Drive sync playback only when in sync mode
    const mode = sessionAudioModeRef.current;
    if (mode === 'sync') {
      applyEvent(evt);
    }
    if (evt.type === 'session-end') {
      setShowEndedOverlay(true);
    }
  });

  // Track current audio mode in a ref so the bus callback (created once) can read it
  const sessionAudioModeRef = useRef('sync');

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

  // Canonical visual layer (creator-controlled). Default visualizer.
  const sessionVisualLayer = session?.visual_layer || 'visualizer';
  const portalsAvailable = sessionVisualLayer === 'portals' && !!session?.portal_room_id;

  // Phase 5.6 — derive audio mode + handle subscriber failure fallback
  const sessionAudioMode = session?.audio_mode || session?.state?.audio_mode || 'sync';
  const [effectiveAudioMode, setEffectiveAudioMode] = useState('sync');
  useEffect(() => {
    setEffectiveAudioMode(sessionAudioMode);
    sessionAudioModeRef.current = sessionAudioMode;
  }, [sessionAudioMode]);

  // Phase 5.7 — initial sync hydration when nowPlaying first arrives
  useEffect(() => {
    if (hasHydratedRef.current) return;
    if (effectiveAudioMode !== 'sync') return;
    if (!nowPlaying || !nowPlaying.track_url) return;
    hasHydratedRef.current = true;
    hydrate(nowPlaying);
  }, [nowPlaying, effectiveAudioMode, hydrate]);

  // Phase 5.8 — if Streamr subscribe ends in error/unavailable, fall back to sync
  useEffect(() => {
    if (sessionAudioMode !== 'streamr') return;
    if (streamr.status === 'error' || streamr.status === 'unavailable') {
      if (!streamrToastShownRef.current) {
        streamrToastShownRef.current = true;
        toast('Live audio unavailable — switching to synchronized playback.', { icon: '🎧' });
      }
      setEffectiveAudioMode('sync');
      streamr.stop();
    }
  }, [streamr.status, sessionAudioMode]);

  // Phase 5.7 — autoplay-blocked toast (one-time)
  const autoplayToastShownRef = useRef(false);
  useEffect(() => {
    if (autoplayBlocked && !autoplayToastShownRef.current) {
      autoplayToastShownRef.current = true;
      toast('Tap to start playback — synchronized mode requires user interaction.', { icon: '🔊' });
    }
  }, [autoplayBlocked]);

  // Phase 5.7 — flip session-end overlay when status transitions to completed
  useEffect(() => {
    if (session?.status === 'completed' || session?.status === 'archived') {
      setShowEndedOverlay(true);
      try { fanAudioRef.current?.pause?.(); } catch {}
    }
  }, [session?.status]);

  // ----- Visual layer analytics (Intelligence OS) -----
  // Increment per-mode choice counters once each, and accumulate time-in-3D.
  const bumpAnalytics = async (patch) => {
    if (!roomId) return;
    try {
      const rows = await base44.entities.LiveSession.filter({ id: roomId });
      const cur = rows[0]?.visual_layer_analytics || {
        visual_layer_enabled_by_creator: portalsAvailable,
        fan_visual_layer_choices: { standard: 0, portals: 0 },
        portals_load_failures: 0,
        total_time_in_3d_ms: 0,
      };
      const next = {
        visual_layer_enabled_by_creator: !!cur.visual_layer_enabled_by_creator || portalsAvailable,
        fan_visual_layer_choices: {
          standard: (cur.fan_visual_layer_choices?.standard || 0) + (patch.standard || 0),
          portals: (cur.fan_visual_layer_choices?.portals || 0) + (patch.portals || 0),
        },
        portals_load_failures: (cur.portals_load_failures || 0) + (patch.failures || 0),
        total_time_in_3d_ms: (cur.total_time_in_3d_ms || 0) + (patch.time_in_3d_ms || 0),
      };
      await base44.entities.LiveSession.update(roomId, { visual_layer_analytics: next });
    } catch { /* silent — analytics must never break the watch experience */ }
  };

  // When fan switches mode, count it (once per mode) and track 3D dwell time.
  useEffect(() => {
    if (!portalsAvailable) return;
    if (fanVisualPreference === 'portals') {
      portalsEntryMsRef.current = Date.now();
      if (!analyticsCountedRef.current.portals) {
        analyticsCountedRef.current.portals = true;
        bumpAnalytics({ portals: 1 });
      }
    } else {
      // Leaving 3D — flush dwell time
      if (portalsEntryMsRef.current) {
        const dwell = Date.now() - portalsEntryMsRef.current;
        portalsEntryMsRef.current = 0;
        if (dwell > 0) bumpAnalytics({ time_in_3d_ms: dwell });
      }
      if (!analyticsCountedRef.current.standard) {
        analyticsCountedRef.current.standard = true;
        bumpAnalytics({ standard: 1 });
      }
    }
  }, [fanVisualPreference, portalsAvailable]);

  // On unmount: flush in-progress 3D dwell time.
  useEffect(() => {
    return () => {
      if (portalsEntryMsRef.current) {
        const dwell = Date.now() - portalsEntryMsRef.current;
        portalsEntryMsRef.current = 0;
        if (dwell > 0) bumpAnalytics({ time_in_3d_ms: dwell });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If fan picks 3D but the Portals iframe fails to load within 8s, fall back.
  useEffect(() => {
    if (fanVisualPreference !== 'portals' || !portalsAvailable) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      const frame = document.querySelector('iframe[title="Live Stage"]');
      // Heuristic: if the frame element exists but never loaded a same-origin
      // document, leave it. Real failures bubble to the iframe onError below.
      if (!frame) {
        toast('3D Mode unavailable. Using Standard Mode.', { icon: '🎧' });
        setFanVisualPreference('standard');
        bumpAnalytics({ failures: 1 });
      }
    }, 8000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [fanVisualPreference, portalsAvailable]);

  // Join as fan once when session is streaming — Phase 5.7 atomic via backend
  useEffect(() => {
    if (!session || !currentUser || hasJoinedRef.current) return;
    if (session.status !== 'streaming') return;
    hasJoinedRef.current = true;

    base44.functions.invoke('joinLiveSession', { sessionId: roomId }).catch(() => {});

    publishEvent('join', {
      userId: currentUser.id,
      displayName: currentUser.full_name || 'Fan',
      type: 'fan',
    });

    // Phase 5.6 — log audio mode on join
    base44.functions.invoke('trackAnalytics', {
      event_type: 'live_participant_join',
      session_id: roomId,
      event_data: { audio_mode: sessionAudioMode },
    }).catch(() => {});

    // Phase 5.8 — in streamr mode, start the subscriber; on failure, fall back to sync
    if (sessionAudioMode === 'streamr' && session.user_id && !streamrStartedRef.current) {
      streamrStartedRef.current = true;
      streamr.startSubscribe();
    }

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
      base44.functions.invoke('leaveLiveSession', { sessionId: roomId }).catch(() => {});
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
              {/* Phase 5.6 — audio mode badge */}
              <div className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                effectiveAudioMode === 'streamr'
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}>
                {effectiveAudioMode === 'streamr' ? 'Live Audio Stream' : 'Synchronized Playback Mode'}
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

        {/* Fan visual layer selector — only shown when creator enabled Portals */}
        {portalsAvailable && (
          <div className="px-4 pt-4">
            <FanVisualLayerSelector
              value={fanVisualPreference}
              onChange={setFanVisualPreference}
            />
          </div>
        )}

        {/* Live Visualizer (Standard view) — shown when fan picked standard OR creator didn't enable Portals */}
        {session.active_visualizer_preset_id && (!portalsAvailable || fanVisualPreference === 'standard') && (
          <div className="px-4 pt-4">
            <LiveVisualizer
              style={session.active_visualizer_preset_id}
              isPlaying={!!nowPlaying?.isPlaying}
              recentReactions={recentEvents.filter(e => e.type === 'reaction').length}
              audioData={effectiveAudioMode === 'sync' ? audioData : null}
            />
          </div>
        )}

        {/* Phase 5.7 — hidden fan audio element (sync mode only) */}
        {effectiveAudioMode === 'sync' && (
          <audio ref={fanAudioRef} crossOrigin="anonymous" playsInline preload="auto" />
        )}

        {/* Phase 5.7/5.8 — autoplay-blocked banner (sync OR streamr) */}
        {((effectiveAudioMode === 'sync' && autoplayBlocked) ||
          (effectiveAudioMode === 'streamr' && streamr.autoplayBlocked)) && (
          <div className="px-4 pt-3">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
              <p className="text-xs text-amber-200 flex-1">
                {effectiveAudioMode === 'streamr'
                  ? 'Tap to start live audio.'
                  : 'Tap to start playback — synchronized mode requires user interaction.'}
              </p>
              <Button
                onClick={effectiveAudioMode === 'streamr' ? streamr.resume : resume}
                size="sm"
                className="rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold gap-1"
              >
                <Play className="w-3.5 h-3.5" /> Play
              </Button>
            </div>
          </div>
        )}

        {/* Portal 3D stage — only when creator enabled Portals AND fan chose 3D */}
        {portalsAvailable && fanVisualPreference === 'portals' ? (
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

      {/* Phase 5.7 — Session ended overlay */}
      {showEndedOverlay && <SessionEndedOverlay sessionId={roomId} />}

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