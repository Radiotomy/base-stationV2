import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Flag, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUS = {
  open:      'bg-amber-500/15 text-amber-300 border-amber-500/30',
  reviewed:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  dismissed: 'bg-white/10 text-muted-foreground border-white/10',
};

const targetLink = (r) => {
  if (r.target_type === 'episode') return `/studios/orvo/episode/${r.target_id}`;
  if (r.target_type === 'podcast') return `/studios/orvo/podcast/${r.target_id}`;
  return null;
};

export default function ReportQueue() {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const rows = await base44.entities.OrvoReport.list('-created_date', 200).catch(() => []);
    setReports(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (report, status) => {
    await base44.entities.OrvoReport.update(report.id, { status });
    setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status } : r)));
    toast.success(status === 'reviewed' ? 'Marked as actioned' : 'Report dismissed');
  };

  const visible = reports.filter((r) => filter === 'all' || (r.status || 'open') === filter);

  if (loading) return <div className="h-24 rounded-2xl bg-muted animate-pulse" />;

  return (
    <div>
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit mb-4">
        {['open', 'reviewed', 'dismissed', 'all'].map((f) => (
          <button
            key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${filter === f ? 'bg-purple-500/20 text-purple-300' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {f}
            {f === 'open' && ` · ${reports.filter((r) => (r.status || 'open') === 'open').length}`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="p-8 rounded-2xl bg-card border border-dashed border-border text-center">
          <Flag className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Nothing in this queue.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const link = targetLink(r);
            return (
              <div key={r.id} className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground capitalize">
                      {r.target_type} reported
                      {link && (
                        <Link to={link} className="ml-2 text-xs text-purple-300 hover:underline inline-flex items-center gap-1">
                          open <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.created_date).toLocaleString()} · target {r.target_id}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${STATUS[r.status || 'open']}`}>
                    {r.status || 'open'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{r.reason}</p>
                {(r.status || 'open') === 'open' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="rounded-xl text-xs" onClick={() => setStatus(r, 'reviewed')}>
                      Mark actioned
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => setStatus(r, 'dismissed')}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}