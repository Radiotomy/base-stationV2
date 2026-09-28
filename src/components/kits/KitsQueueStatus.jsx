import { Loader2, AlertCircle } from 'lucide-react';

/** Honest progress for a Kits render: queue position/ETA, then rendering. */
export default function KitsQueueStatus({ job }) {
  if (job.status === 'failed') {
    return <p className="text-xs text-destructive flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{job.error}</p>;
  }
  if (!job.busy) return null;
  const text = job.status === 'pending'
    ? `In the Kits queue — #${job.queue?.position || 1}, about ${Math.max(5, job.queue?.eta_seconds || 60)}s until it starts`
    : 'Kits is singing it now…';
  return <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{text}</p>;
}