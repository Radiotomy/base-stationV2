import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Play, Square, Zap, ArrowLeft, Users, Clock, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import LiveChatPanel from '@/components/live/LiveChatPanel';
import LiveNowPlaying from '@/components/live/LiveNowPlaying';
import LiveReactionBar from '@/components/live/LiveReactionBar';
import LiveTrackSelector from '@/components/live/LiveTrackSelector';

export default function LiveStudio() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionDbId, setSessionDbId] = useState(''); // LiveSession entity id
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const mediaStream = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Real-time viewer count via LiveSession subscription
  useEffect(() => {
    if (!sessionDbId) return;
    const unsub = base44.entities.LiveSession.subscribe(evt => {
      if ((evt.type === 'update') && evt.data?.id === sessionDbId) {
        setViewerCount(evt.data.viewer_count || 0);
      }
    });
    return unsub;
  }, [sessionDbId]);

  const watchUrl = sessionId
    ? `${window.location.origin}/live-watch?roomId=${sessionId}`
    : null;

  const copyWatchLink = () => {
    if (!watchUrl) return;
    navigator.clipboard.writeText(watchUrl);
    toast.success('Watch link copied!');
  };

  const createSession = async () => {
    if (!title) { toast.error('Enter a session title'); return; }
    try {
      const result = await base44.functions.invoke('createLiveSession', { title, description, tags: [] });
      setSessionId(result.data.session_id);
      setSessionDbId(result.data.session_id);
      toast.success('Live session created!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const startStreaming = async () => {
    if (!sessionId) { toast.error('Create a session first'); return; }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => { mediaStream.current = stream; })
        .catch(() => { /* mic optional — artists may use track playback only */ });

      // Create Portal 3D room (non-blocking — if it fails we still go live)
      base44.functions.invoke('createPortalRoom', {
        sessionId,
        title,
        coverImageUrl: selectedTrack?.thumbnail_url || '',
      }).catch(err => console.warn('Portal room creation failed:', err.message));

      // Update LiveSession status → streaming
      await base44.entities.LiveSession.update(sessionId, {
        status: 'streaming',
        start_time: new Date().toISOString(),
        ...(selectedTrack && { tracks_used: [selectedTrack.id] }),
      });

      setIsLive(true);
      toast.success('🔴 You are now Live!');

      await base44.functions.invoke('trackAnalytics', {
        event_type: 'session_started',
        session_id: sessionId,
        event_data: { title }
      });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const stopStreaming = async () => {
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(t => t.stop());
    }

    // Update LiveSession status → completed
    await base44.entities.LiveSession.update(sessionId, {
      status: 'completed',
      end_time: new Date().toISOString(),
      duration_seconds: duration,
      peak_viewers: viewerCount,
    });

    setIsLive(false);

    await base44.functions.invoke('trackAnalytics', {
      event_type: 'session_ended',
      session_id: sessionId,
      duration_ms: duration * 1000
    });

    toast.success('Session archived');
  };

  // Duration timer
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        {isLive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="ml-auto flex items-center gap-3">
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
          <p className="text-white/60 text-lg">Stream live sessions, interact with your audience in real-time.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Session Setup + Now Playing */}
          <div className="lg:col-span-1 space-y-4">

            {/* Session Setup */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-black text-foreground">Session Setup</h3>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Title</label>
                <Input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Late Night Jam Session"
                  className="rounded-xl" disabled={isLive} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's happening tonight?"
                  rows={2} className="rounded-xl" disabled={isLive} />
              </div>

              {!sessionId ? (
                <Button onClick={createSession} className="w-full bg-red-600 hover:bg-red-500 rounded-xl font-bold gap-2">
                  <Zap className="w-4 h-4" /> Create Session
                </Button>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-500/20 text-red-400 border-0">Session Ready</Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground">{sessionId.slice(0, 8)}</Badge>
                  </div>
                  <Button
                    onClick={isLive ? stopStreaming : startStreaming}
                    className={`w-full rounded-xl font-bold gap-2 ${isLive ? 'bg-destructive hover:bg-red-600' : 'bg-green-600 hover:bg-green-500'}`}
                  >
                    {isLive
                      ? <><Square className="w-4 h-4" /> Stop Live</>
                      : <><Radio className="w-4 h-4" /> Go Live</>}
                  </Button>
                </>
              )}
            </div>

            {/* Share Link */}
            {sessionId && (
              <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Fan Watch Link</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono text-muted-foreground truncate flex-1 bg-muted/50 px-2 py-1.5 rounded-lg">
                    /live-watch?roomId={sessionId.slice(0, 16)}…
                  </p>
                  <button onClick={copyWatchLink}
                    className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all flex-shrink-0">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a href={watchUrl} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all flex-shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Track Selector */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <h3 className="font-black text-foreground text-sm">Now Playing</h3>
              <LiveTrackSelector
                onSelect={(track) => {
                  setSelectedTrack(track);
                  // Sync track info to session so watch page updates
                  if (sessionId && track) {
                    base44.entities.LiveSession.update(sessionId, {
                      current_track_title: track.title,
                      current_track_artist: currentUser?.full_name || '',
                    }).catch(() => {});
                  }
                }}
                selectedTrack={selectedTrack}
                disabled={isLive}
              />
            </div>

            {/* Now Playing Controls */}
            <LiveNowPlaying track={selectedTrack} />

            {/* Reaction Bar */}
            <LiveReactionBar
              sessionId={sessionId}
              currentUser={currentUser}
              isLive={isLive}
            />
          </div>

          {/* Right: Live Chat */}
          <div className="lg:col-span-2 space-y-4">
            {/* Status banner when not live */}
            <AnimatePresence>
              {!isLive && !sessionId && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-muted/30 rounded-2xl border border-dashed border-border p-8 flex flex-col items-center justify-center text-center gap-3">
                  <Radio className="w-10 h-10 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground font-medium">Set up your session to get started</p>
                  <p className="text-xs text-muted-foreground">Enter a title, pick a track from your library, then Go Live.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live Chat — full height */}
            {sessionId && (
              <div className="h-[600px]">
                <LiveChatPanel sessionId={sessionId} currentUser={currentUser} isLive={isLive} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}