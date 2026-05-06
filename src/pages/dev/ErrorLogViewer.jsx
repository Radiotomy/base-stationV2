import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SEVERITY_COLOR = {
  info: 'bg-blue-500/20 text-blue-300',
  warning: 'bg-yellow-500/20 text-yellow-300',
  error: 'bg-red-500/20 text-red-300',
  critical: 'bg-red-700/30 text-red-200',
};

/**
 * Phase 5.5 — Admin-only dev page for viewing recent error logs.
 */
export default function ErrorLogViewer() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.ErrorLog.list('-created_date', 100);
      setRows(all || []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? rows : rows.filter(r => r.component === filter);
  const components = [...new Set(rows.map(r => r.component))];

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <Badge variant="outline" className="ml-auto">Dev / Phase 5.5</Badge>
      </div>

      <div className="pt-20 pb-12 px-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight flex items-center gap-2">
              <AlertCircle className="w-7 h-7 text-red-400" /> Error Log
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Most recent {rows.length} entries</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dev/smoke-tests"><Button variant="outline" className="rounded-xl">Smoke Tests</Button></Link>
            <Button onClick={load} disabled={loading} variant="outline" size="icon" className="rounded-xl">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        {components.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === 'all' ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              All ({rows.length})
            </button>
            {components.map(c => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === c ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                {c} ({rows.filter(r => r.component === c).length})
              </button>
            ))}
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No errors logged 🎉
          </div>
        )}

        <div className="space-y-2">
          {filtered.map(row => (
            <div key={row.id} className="rounded-xl bg-card border border-border p-4">
              <div className="flex items-start gap-3 flex-wrap">
                <Badge className={`${SEVERITY_COLOR[row.severity] || SEVERITY_COLOR.error} border-0 text-xs`}>
                  {row.severity || 'error'}
                </Badge>
                <Badge variant="outline" className="text-xs">{row.component}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(row.created_date).toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground mt-2 break-words">{row.message}</p>
              {row.user_email && (
                <p className="text-xs text-muted-foreground mt-1">user: {row.user_email}</p>
              )}
              {row.stack && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">stack</summary>
                  <pre className="text-[10px] bg-muted/40 rounded-lg p-2 mt-1 overflow-x-auto whitespace-pre-wrap break-all">{row.stack}</pre>
                </details>
              )}
              {row.context && (
                <details className="mt-1">
                  <summary className="text-xs text-muted-foreground cursor-pointer">context</summary>
                  <pre className="text-[10px] bg-muted/40 rounded-lg p-2 mt-1 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(row.context, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}