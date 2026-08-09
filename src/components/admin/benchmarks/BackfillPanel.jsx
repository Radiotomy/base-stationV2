import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { History, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Backfills the neural layer onto pre-automation assets. Dry run is the default
// on purpose — every dispatch is a paid GPU prediction, so the operator sees the
// exact list before anything fires.
export default function BackfillPanel() {
  const { toast } = useToast();
  const [limit, setLimit] = useState(5);
  const [includeFailed, setIncludeFailed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async (dryRun) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('backfillBaseMarkV2', {
        limit: Number(limit),
        dryRun,
        includeFailed,
      });
      setResult(res.data);
      if (!dryRun) {
        toast({ title: `Dispatched ${res.data.dispatched?.length || 0} embeds` });
      }
    } catch (e) {
      toast({ title: 'Backfill failed', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <div className="merc-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-[#FF9A4D]" />
        <p className="font-bold text-foreground text-sm">Neural layer backfill</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Marks assets created before auto-marking went live. Preview first — each dispatch is a GPU
        prediction. Run this only after the rate-preserving container is verified, or 48kHz masters
        will fail again.
      </p>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Batch size</p>
          <Input
            type="number"
            min={1}
            max={25}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-24 h-9"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
          <Checkbox checked={includeFailed} onCheckedChange={(v) => setIncludeFailed(!!v)} />
          Retry previously failed
        </label>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => run(true)}>
          {busy && <Loader2 className="w-3 h-3 animate-spin" />} Preview
        </Button>
        <Button size="sm" disabled={busy} onClick={() => run(false)}>
          Dispatch batch
        </Button>
      </div>

      {result && (
        <div className="text-xs space-y-1 border-t border-white/10 pt-3">
          <p className="text-muted-foreground">
            {result.dry_run ? 'Would dispatch' : 'Dispatched'}{' '}
            <span className="text-foreground font-bold">
              {(result.would_dispatch || result.dispatched || []).length}
            </span>{' '}
            · {result.remaining} remaining in backlog
          </p>
          {(result.would_dispatch || result.dispatched || []).map((r) => (
            <p key={r.id} className="text-muted-foreground/80 truncate">
              {r.title}
              {r.previous_status ? ` — retrying ${r.previous_status}` : ''}
            </p>
          ))}
          {result.failed?.map((f) => (
            <p key={f.id} className="text-red-400 truncate">
              {f.title} — {f.error}
            </p>
          ))}
          {result.skipped?.map((s) => (
            <p key={s.id} className="text-amber-400 truncate">
              skipped {s.title} — {s.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}