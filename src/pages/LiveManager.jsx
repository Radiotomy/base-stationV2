import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Radio, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SessionStatsBar from '@/components/livemanager/SessionStatsBar';
import SessionCard from '@/components/livemanager/SessionCard';

const FILTERS = ['all', 'streaming', 'draft', 'completed', 'archived'];

export default function LiveManager() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [user, setUser] = useState(null);

  const load = useCallback(async (uid) => {
    const rows = await base44.entities.LiveSession.filter({ user_id: uid }, '-created_date', 100);
    setSessions(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); load(u.id); }).catch(() => setLoading(false));
  }, [load]);

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
      </div>

      <div className="relative overflow-hidden pt-20 pb-10 px-6 bg-gradient-to-br from-red-900/30 to-black">
        <div className="max-w-5xl mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Live Manager</h1>
            <p className="text-white/60">Manage, moderate, and review all your live sessions and 3D venues.</p>
          </div>
          <Button asChild className="bg-red-600 hover:bg-red-500 rounded-xl font-bold gap-2">
            <Link to="/live-studio"><Plus className="w-4 h-4" /> New Session</Link>
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <SessionStatsBar sessions={sessions} />

        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-colors ${
                filter === f ? 'bg-red-600 text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'streaming' ? '🔴 Live' : f}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading your sessions…</p>
        ) : filtered.length === 0 ? (
          <div className="bg-muted/30 rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
            <Radio className="w-10 h-10 text-muted-foreground opacity-30 mx-auto" />
            <p className="text-muted-foreground font-medium">
              {filter === 'all' ? 'No live sessions yet — create your first one!' : `No ${filter} sessions.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(s => (
              <SessionCard key={s.id} session={s} onChanged={() => user && load(user.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}