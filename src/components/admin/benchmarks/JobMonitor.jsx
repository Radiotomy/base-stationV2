import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

// Rows are only written once EVERY job in a batch resolves, so a run sits at
// "running" until the last prediction lands. Polling early is safe and cannot
// half-record a batch.
export default function JobMonitor({ refreshKey, onRecorded }) {
  const { toast } = useToast();
  const [runs, setRuns] = useState([]);
  const [polling, setPolling] = useState(null);

  const load = () => base44.entities.BaseMarkRun.list('-created_date', 40).then(setRuns);
  useEffect(() => { load(); }, [refreshKey]);

  const poll = async (run) => {
    setPolling(run.id);
    try {
      const res = await base44.functions.smokeBaseMarkV4({
        action: run.kind === 'null_scan' ? 'null_poll' : 'grid_poll',
        run_id: run.run_id,
        jobs: run.jobs.filter((j) => j.prediction_id),
        codec: run.params?.codec,
        payload_hex: run.params?.payload_hex,
        source_class: run.params?.source_class,
      });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      if (data.pending === 0) {
        await base44.entities.BaseMarkRun.update(run.id, {
          status: 'completed',
          recorded: data.recorded || 0,
          summary: data.batch_summary || { results: data.results?.length },
        });
        toast({ title: `Run complete — ${data.recorded} rows recorded` });
        onRecorded?.();
      } else {
        toast({ title: `${data.pending} job${data.pending === 1 ? '' : 's'} still running` });
      }
      load();
    } catch (e) {
      toast({ title: 'Poll failed', description: e.message, variant: 'destructive' });
    }
    setPolling(null);
  };

  if (!runs.length) {
    return <p className="text-xs text-muted-foreground py-4">No runs dispatched from here yet.</p>;
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const dispatched = run.jobs?.filter((j) => j.prediction_id).length || 0;
        const rejected = run.jobs?.filter((j) => j.error).length || 0;
        const done = run.status === 'completed';
        return (
          <div key={run.id} className="merc-card rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {done
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    : <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />}
                  <p className="text-sm font-bold text-foreground truncate">{run.run_id}</p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {run.kind === 'null_scan' ? 'Null scan' : 'Attack grid'} · {dispatched} job{dispatched === 1 ? '' : 's'} ·
                  {' '}codec {run.params?.codec || 'none'}
                  {run.params?.source_class ? ` · ${run.params.source_class}` : ''}
                  {run.created_date ? ` · ${format(new Date(run.created_date), 'MMM d HH:mm')}` : ''}
                </p>
                {done && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {run.recorded} rows recorded
                    {run.summary?.false_positives > 0 && (
                      <span className="text-red-400 font-bold"> · {run.summary.false_positives} false positive(s)</span>
                    )}
                  </p>
                )}
                {rejected > 0 && (
                  <p className="text-[11px] text-amber-400 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {rejected} source(s) rejected before dispatch
                  </p>
                )}
              </div>
              {!done && (
                <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 flex-shrink-0"
                  onClick={() => poll(run)} disabled={polling === run.id}>
                  <RefreshCw className={`w-3.5 h-3.5 ${polling === run.id ? 'animate-spin' : ''}`} /> Poll
                </Button>
              )}
            </div>
            {rejected > 0 && (
              <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5">
                {run.jobs.filter((j) => j.error).map((j, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground truncate">{j.error}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}