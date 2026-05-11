import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Play, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AuditReportsPanel() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const rows = await base44.entities.BlockchainAuditReport.list('-generated_at', 12).catch(() => []);
    setReports(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      await base44.functions.invoke('runBlockchainAudit', {});
      toast.success('Audit report generated');
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Audit failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" /> Monthly Audit Reports
        </h2>
        <Button onClick={runNow} disabled={running} size="sm" className="rounded-lg gap-2 bg-blue-600 hover:bg-blue-500">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Run Audit Now
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
          No audit reports yet. Run one to generate the first report.
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border">
          {reports.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-foreground">{r.period_label || 'Period'}</span>
              <Badge className="bg-muted text-muted-foreground text-xs">
                {r.totals?.transactions || 0} txs
              </Badge>
              <Badge className="bg-green-500/15 text-green-400 text-xs">
                {r.totals?.success || 0} ok
              </Badge>
              {r.totals?.failed > 0 && (
                <Badge className="bg-red-500/15 text-red-400 text-xs">{r.totals.failed} failed</Badge>
              )}
              <Badge className="bg-amber-500/15 text-amber-400 text-xs">
                ${Number(r.totals?.gas_usd || 0).toFixed(4)} gas
              </Badge>
              {r.anomalies?.length > 0 && (
                <Badge className="bg-orange-500/15 text-orange-400 text-xs gap-1">
                  <AlertTriangle className="w-3 h-3" /> {r.anomalies.length} anomal{r.anomalies.length === 1 ? 'y' : 'ies'}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {r.generated_at ? new Date(r.generated_at).toLocaleString() : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}