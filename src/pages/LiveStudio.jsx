import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, Play, Square, Users, Share2, Settings, Zap, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import MultiTrackMixer from '@/components/audio/MultiTrackMixer';

export default function LiveStudio() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracks, setTracks] = useState([]);
  const mediaStream = useRef(null);

  const createSession = async () => {
    if (!title) {
      toast.error('Enter a session title');
      return;
    }
    try {
      const result = await base44.functions.invoke('createLiveSession', {
        title,
        description,
        tags: []
      });
      setSessionId(result.session_id);
      toast.success('Live session created!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const startStreaming = async () => {
    if (!sessionId) {
      toast.error('Create a session first');
      return;
    }
    try {
      // Request audio/video permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStream.current = stream;
      setIsLive(true);
      toast.success('Live streaming started!');

      // Track analytics
      await base44.functions.invoke('trackAnalytics', {
        event_type: 'session_started',
        session_id: sessionId,
        event_data: { title }
      });
    } catch (error) {
      toast.error('Microphone access denied');
    }
  };

  const stopStreaming = async () => {
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(t => t.stop());
    }
    setIsLive(false);

    // Update session
    await base44.functions.invoke('trackAnalytics', {
      event_type: 'session_ended',
      session_id: sessionId,
      duration_ms: duration * 1000
    });
    
    toast.success('Session archived');
  };

  // Timer for duration
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
      {/* Header with Back Button */}
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-red-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🔴 Live Studio</h1>
          <p className="text-white/60 text-lg">Stream live sessions, interact with viewers, record for later.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Setup Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-black text-foreground">Session Setup</h3>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Late Night Jam Session"
                  className="rounded-xl"
                  disabled={isLive}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's happening tonight?"
                  rows={2}
                  className="rounded-xl"
                  disabled={isLive}
                />
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
                    {isLive ? (
                      <><Square className="w-4 h-4" /> Stop Live</>
                    ) : (
                      <><Play className="w-4 h-4" /> Go Live</>
                    )}
                  </Button>
                </>
              )}

              {isLive && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/20 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-semibold text-red-400">Live Now</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-mono text-lg text-foreground">{formatDuration(duration)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Viewers</p>
                      <p className="font-mono text-lg text-foreground">{viewerCount}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Editor Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Waveform would go here */}
            <div className="bg-card rounded-2xl border border-border p-6 min-h-48 flex items-center justify-center">
              <p className="text-muted-foreground text-center">Live audio waveform visualization goes here</p>
            </div>

            {/* Multi-Track Mixer */}
            {tracks.length > 0 && (
              <div>
                <h4 className="font-bold text-foreground mb-2 text-sm">Multi-Track Mixer</h4>
                <MultiTrackMixer tracks={tracks} onChange={() => {}} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}