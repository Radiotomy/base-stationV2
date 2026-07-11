import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Radio, BarChart3, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PublishSessionToAudiusButton from '@/components/livemanager/PublishSessionToAudiusButton';

function formatDuration(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export default function LiveSessionsTab({ userId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.LiveSession
      .filter({ user_id: userId, status: 'completed' }, '-created_date', 50)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="text-muted-foreground text-center py-12">Loading your sessions…</p>;

  if (sessions.length === 0) return (
    <div className="text-center py-12 border border-dashed border-border rounded-2xl">
      <Radio className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
      <p className="text-muted-foreground text-sm">No completed live sessions yet.</p>
      <Link to="/live-studio" className="text-purple-400 text-xs hover:text-purple-300 mt-2 block">Go Live →</Link>
    </div>
  );

  return (
    <div className="space-y-3">
      {sessions.map(s => (
        <div key={s.id} className="p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground truncate">{s.title}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {s.peak_viewers || 0} peak</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(s.duration_seconds)}</span>
              {s.start_time && <span>{new Date(s.start_time).toLocaleDateString()}</span>}
            </div>
          </div>
          <Badge className="bg-green-500/20 text-green-400 border-0">Completed</Badge>
          <div className="flex items-center gap-2 flex-wrap">
            <PublishSessionToAudiusButton sessionId={s.id} />
            <Button asChild size="sm" variant="secondary" className="rounded-xl gap-1.5">
              <Link to={`/live-summary?sessionId=${s.id}`}><BarChart3 className="w-3.5 h-3.5" /> Summary</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}