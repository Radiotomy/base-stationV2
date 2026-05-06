import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Radio, Square, Zap, ArrowLeft, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import { useLiveEventBus } from '@/hooks/useLiveEventBus';
import LiveChatPanel from '@/components/live/LiveChatPanel';
import LiveReactionBar from '@/components/live/LiveReactionBar';
import LiveTrackSelector from '@/components/live/LiveTrackSelector';
import PerformerControls from '@/components/live/PerformerControls';
import ShareLinkButton from '@/components/live/ShareLinkButton';
import ParticipantList from '@/components/live/ParticipantList';
import EventFeed from '@/components/live/EventFeed';
import Phase4Panel from '@/components/live/Phase4Panel';
import LiveQuestPanel from '@/components/live/LiveQuestPanel';

export default function LiveStudio() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);

  // Playback state
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [micActive, setMicActive] = useState(false);
  const micStreamRef = useRef(null);
  const mediaStreamRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Event bus — performer publishes + listens
  const { publishEvent } = useLiveEventBus(sessionId, (evt) => {
    setRecentEvents((prev) => [...prev.slice(-19), evt]);
  });

  // Subscribe to session for viewer count + participant list
  useEffect(() => {
    if (!sessionId) return;
    const unsub = base44.entities.LiveSession.subscribe((evt) => {
      if (evt.data?.id !== sessionId) return;
      setViewerCount(evt.data.viewer_count || 0);
      setParticipants(evt.data?.state?.participants || []);
      setRecentEvents(evt.data?.state?.recentEvents || []);
    });
    return unsub;
  }, [sessionId]);

  const createSession = async () => {
    if (!title) { toast.error('Enter a session title'); return; }
    try {
      const result = await base44.functions.invoke('createLiveSession', { title, description, tags: [] });
      const sid = result.data.session_id;
      setSessionId(sid);

      if (currentUser) {
        await base44.entities.LiveSession.update(sid, {
          state: {
            participants: [{
              id: currentUser.id,
              displayName: currentUser.full_name || 'Performer',
              type: 'performer',
              avatarUrl: '',
            }],
            recentEvents: [],
            nowPlaying: { trackId: '', title: '', position: 0, isPlaying: false },
          }
        });
      }
      toast.success('Session created!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const startStreaming = async () => {
    if (!sessionId) { toast.error('Create a session first'); return; }
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        mediaStreamRef.current = stream;
      } catch { /* mic optional */ }

      // Optional Portal room (non-blocking)
      base44.functions.invoke('createPortalRoom', {
        sessionId,
        title,
        coverImageUrl: selectedTrack?.thumbnail_url || '',
      }).catch(() => {});

      await base44.entities.LiveSession.update(sessionId, {
        status: 'streaming',
        start_time: new Date().toISOString(),
        ...(selectedTrack && { tracks_used: [selectedTrack.id] }),
      });

      setIsLive(true);
      base44.functions.invoke('trackAnalytics', {
        event_type: 'live_session_started',
        session_id: sessionId,
        event_data: { title },
      }).catch(() => {});
      await publishEvent('performer-start', { title, performerId: currentUser?.id });
      toast.success('🔴 You are now Live!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const stopStreaming = async () => {
    if (audioRef.current) audioRef.current.pause();
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); setMicActive(false); }

    await base44.entities.LiveSession.update(sessionId, {
      status: 'completed',
      end_time: new Date().toISOString(),
      duration_seconds: duration,
      peak_viewers: viewerCount,
    });

    await publishEvent('leave', { performerId: currentUser?.id, role: 'performer' });

    // Fire analytics + recording (non-blocking on UI redirect)
    base44.functions.invoke('trackAnalytics', {
      event_type: 'live_session_ended',
      session_id: sessionId,
      event_data: { duration_seconds: duration, peak_viewers: viewerCount },
    }).catch(() => {});

    setIsLive(false);
    toast.success('Session ended — generating bundle…');

    try {
      await base44.functions.invoke('recordLiveSession', { sessionId });
    } catch { /* non-blocking */ }

    navigate(`/live-summary?sessionId=${sessionId}`);
  };

  // Helper: read + merge state patch
  const buildStateUpdate = async (patch) => {
    try {
      const results = await base44.entities.LiveSession.filter({ id: sessionId });
      const current = results[0]?.state || {};
      return { ...current, ...patch };
    } catch {
      return patch;
    }
  };

  const handleTrackSelect = async (track) => {
    setSelectedTrack(track);
    setIsPlaying(false);
    setCurrentTime(0);
    if (!sessionId || !track) return;

    const newState = await buildStateUpdate({
      nowPlaying: { trackId: track.id, title: track.title, position: 0, isPlaying: false },
    });
    await base44.entities.LiveSession.update(sessionId, {
      current_track_title: track.title,
      current_track_artist: currentUser?.full_name || '',
      state: newState,
    });
    await publishEvent('scene-change', { trackId: track.id, title: track.title });
  };

  const handlePlay = async () => {
    if (!audioRef.current) return;
    audioRef.current.play();
    setIsPlaying(true);
    await publishEvent('play', { title: selectedTrack?.title, position: currentTime });
    const newState = await buildStateUpdate({
      nowPlaying: { trackId: selectedTrack?.id, title: selectedTrack?.title, position: currentTime, isPlaying: true },
    });
    base44.entities.LiveSession.update(sessionId, { state: newState }).catch(() => {});
  };

  const handlePause = async () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
    await publishEvent('pause', { title: selectedTrack?.title, position: currentTime });
    const newState = await buildStateUpdate({
      nowPlaying: { trackId: selectedTrack?.id, title: selectedTrack?.title, position: currentTime, isPlaying: false },
    });
    base44.entities.LiveSession.update(sessionId, { state: newState }).catch(() => {});
  };

  const handleRestart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    publishEvent('seek', { position: 0 }).catch(() => {});
  };

  const handleSeek = async (newTime) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    await publishEvent('seek', { position: newTime, title: selectedTrack?.title });
  };

  const handleMicToggle = async () => {
    if (micActive) {
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      setMicActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        setMicActive(true);
      } catch {
        toast.error('Mic access denied');
      }
    }
  };

  // Duration timer
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const formatDuration = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden audio element */}
      {selectedTrack?.file_url && (
        <audio
          ref={audioRef}
          src={selectedTrack.file_url}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
          onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        />
      )}

      {/* Header */}
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        {isLive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-400">LIVE</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />{formatDuration(duration)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />{viewerCount}
            </div>
          </motion.div>
        )}
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-red-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🔴 Live Studio</h1>
          <p className="text-white/60 text-lg">Synchronized event timeline — perform live for your audience.</p>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left column */}
          <div className="lg:col-span-1 space-y-4">

            {/* Session Setup */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-black text-foreground">Session Setup</h3>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Title</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Late Night Jam" className="rounded-xl" disabled={isLive} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's happening tonight?" rows={2} className="rounded-xl" disabled={isLive} />
              </div>

              {!sessionId ? (
                <Button onClick={createSession} className="w-full bg-red-600 hover:bg-red-500 rounded-xl font-bold gap-2">
                  <Zap className="w-4 h-4" /> Create Session
                </Button>
              ) : (
                <>
                  <Badge className="bg-red-500/20 text-red-400 border-0">Session Ready</Badge>
                  <Button
                    onClick={isLive ? stopStreaming : startStreaming}
                    className={`w-full rounded-xl font-bold gap-2 ${isLive ? 'bg-destructive hover:bg-red-600' : 'bg-green-600 hover:bg-green-500'}`}
                  >
                    {isLive ? <><Square className="w-4 h-4" /> Stop Live</> : <><Radio className="w-4 h-4" /> Go Live</>}
                  </Button>
                </>
              )}
            </div>

            {/* Share link */}
            <ShareLinkButton sessionId={sessionId} />

            {/* Track Selector */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <h3 className="font-black text-foreground text-sm">Track</h3>
              <LiveTrackSelector onSelect={handleTrackSelect} selectedTrack={selectedTrack} disabled={false} />
            </div>

            {/* Performer Controls */}
            {selectedTrack && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <h3 className="font-black text-foreground text-sm">Controls</h3>
                <PerformerControls
                  track={selectedTrack}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={audioDuration}
                  micActive={micActive}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onRestart={handleRestart}
                  onSeek={handleSeek}
                  onMicToggle={handleMicToggle}
                  isLive={isLive}
                />
              </div>
            )}

            {/* Reactions */}
            <LiveReactionBar sessionId={sessionId} currentUser={currentUser} isLive={isLive} />

            {/* Participants */}
            <ParticipantList participants={participants} />

            {/* Phase 4 — Real-Time Expansion */}
            <Phase4Panel sessionId={sessionId} isLive={isLive} />

            {/* Phase 4 — Fan Quests */}
            <LiveQuestPanel sessionId={sessionId} isPerformer={true} currentUserId={currentUser?.id} />
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">

            {/* Event Bus feed */}
            {sessionId && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <h3 className="font-black text-foreground text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse inline-block" />
                  Event Bus
                </h3>
                <EventFeed events={recentEvents} />
              </div>
            )}

            <AnimatePresence>
              {!sessionId && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-muted/30 rounded-2xl border border-dashed border-border p-8 flex flex-col items-center justify-center text-center gap-3">
                  <Radio className="w-10 h-10 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground font-medium">Create a session to get started</p>
                </motion.div>
              )}
            </AnimatePresence>

            {sessionId && (
              <div className="h-[500px]">
                <LiveChatPanel sessionId={sessionId} currentUser={currentUser} isLive={isLive} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}