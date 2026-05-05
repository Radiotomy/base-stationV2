import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Heart, MessageSquare, Play, Pause,
  Crown, Download, ExternalLink, Radio, Clock, Headphones, Loader2, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function StatTile({ icon: Icon, label, value, color = 'bg-purple-600' }) {
  return (
    <div className="p-5 rounded-2xl bg-card border border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-semibold uppercase">{label}</p>
        <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}

export default function LiveSummary() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('sessionId');
  const [summary, setSummary] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const handlePublishToAudius = async () => {
    if (!bundle?.id) return;
    setPublishing(true);
    try {
      const r = await base44.functions.invoke('publishLiveSessionBundle', { bundleId: bundle.id });
      if (r.data?.audius_track_id) {
        setBundle(b => ({ ...b, audius_track_id: r.data.audius_track_id, audius_publish_status: 'success' }));
        toast.success('Session published to Audius!', { icon: '🎧' });
      } else {
        toast.error(r.data?.error || 'Publish failed');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    Promise.all([
      base44.functions.invoke('getLiveSessionSummary', { sessionId }).then(r => r.data).catch(() => null),
      base44.entities.LiveSessionBundle.filter({ session_id: sessionId }, '-created_date', 1).then(r => r[0]).catch(() => null),
    ]).then(([sum, bun]) => {
      setSummary(sum);
      setBundle(bun);
      setLoading(false);
    });
  }, [sessionId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  if (!summary) return (
    <div className="min-h-screen flex items-center justify-center text-center px-6">
      <div>
        <Radio className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-black mb-2">Session Not Found</h2>
        <Link to="/live-studio" className="text-purple-400 text-sm">← Live Studio</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/live-studio" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back to Live Studio</span>
        </Link>
      </div>

      {/* Hero */}
      <div className="pt-20 pb-10 px-6 bg-gradient-to-br from-purple-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <Badge className="mb-3 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Session Complete</Badge>
          <h1 className="text-4xl font-black text-white mb-2">{summary.title}</h1>
          <div className="flex items-center gap-4 text-white/60 text-sm">
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{formatDuration(summary.duration_seconds)}</span>
            <span>{summary.peak_viewers} peak viewers</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile icon={Heart}          label="Reactions"     value={summary.total_reactions}     color="bg-red-600" />
          <StatTile icon={MessageSquare}  label="Chat Messages" value={summary.total_chat_messages} color="bg-blue-600" />
          <StatTile icon={Users}          label="Participants"  value={summary.total_participants}  color="bg-emerald-600" />
          <StatTile icon={Play}           label="Plays"         value={summary.play_count}          color="bg-purple-600" />
        </div>

        {/* Top Fans */}
        {summary.top_fans?.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-black text-foreground mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" /> Top Fans
            </h2>
            <div className="space-y-2">
              {summary.top_fans.map((fan, i) => (
                <motion.div key={fan.user_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                  <span className={`w-7 text-center font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-xs font-black text-white">
                    {(fan.user_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{fan.user_name}</p>
                    <p className="text-xs text-muted-foreground">{fan.reactions || 0} reactions · {fan.messages || 0} messages</p>
                  </div>
                  <Badge className="bg-yellow-500/20 text-yellow-300 border-0">{fan.score} pts</Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Event Timeline */}
        {summary.events?.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-black text-foreground mb-4">Event Timeline</h2>
            <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
              {summary.events.map(evt => (
                <div key={evt.id} className="flex items-center gap-2 py-1 px-2 rounded bg-muted/30">
                  <span className="text-muted-foreground">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  <span className="text-foreground/80 capitalize font-semibold">{evt.type}</span>
                  {evt.payload?.title && <span className="text-muted-foreground truncate">— {evt.payload.title}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bundle Downloads */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
          <h2 className="text-lg font-black text-foreground mb-2">Session Bundle</h2>
          {bundle ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <a href={bundle.event_log_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full rounded-xl gap-2 justify-start">
                    <Download className="w-4 h-4" /> Event Log (JSON)
                  </Button>
                </a>
                <a href={bundle.chat_log_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full rounded-xl gap-2 justify-start">
                    <Download className="w-4 h-4" /> Chat Log (JSON)
                  </Button>
                </a>
              </div>
              {bundle.audius_track_id ? (
                <Button disabled className="w-full rounded-xl gap-2 mt-2 text-emerald-400 border-emerald-500/30" variant="outline">
                  <CheckCircle2 className="w-4 h-4" /> Published to Audius
                </Button>
              ) : (
                <Button onClick={handlePublishToAudius} disabled={publishing} className="w-full rounded-xl gap-2 mt-2 bg-emerald-600 hover:bg-emerald-500">
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
                  {publishing ? 'Publishing…' : 'Publish Session to Audius'}
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No bundle was generated for this session.</p>
          )}
        </div>
      </div>
    </div>
  );
}