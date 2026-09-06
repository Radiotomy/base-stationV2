import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Fingerprint, Loader2 } from 'lucide-react';

// Builds the reference side of the sweep. Surfaced as its own panel because the
// sweep is structurally unable to find anything without references — an admin
// looking at an empty findings list needs to see whether that means "nothing out
// there" or "we have nothing to compare against".
export default function PrintReferenceBuilder({ onBuilt }) {
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const loadCount = () =>
    base44.entities.AudioFingerprint.list('-created_date', 500).then((r) => setCount(r.length));

  useEffect(() => { loadCount(); }, []);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('backfillAudioPrints', { batchSize: 3 });
      setResult(res.data);
      await loadCount();
      onBuilt?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="merc-card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-[#FF9A4D]" /> Reference prints
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-lg">
            The sweep compares public Audius audio against these. Marked works are printed first, since
            those are the ones with a provenance claim worth recognising. A print writes nothing into the
            audio, so this is safe on already-marked files.
          </p>
        </div>
        <Button onClick={run} disabled={busy} size="sm" className="merc-button shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Build 3 more'}
        </Button>
      </div>

      <p className="text-sm mt-3">
        <span className="font-black text-foreground text-lg">{count ?? '—'}</span>
        <span className="text-muted-foreground text-xs ml-2">references stored</span>
      </p>

      {count === 0 && !busy && (
        <p className="text-xs text-amber-200/80 mt-2">
          Empty — the sweep will refuse to run rather than report a false all-clear.
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            Built {result.printed} · failed {result.failed} · {result.remaining} still eligible
          </p>
          {(result.results || []).filter((r) => !r.ok).map((r) => (
            <p key={r.asset_id} className="text-[11px] text-muted-foreground font-mono break-all">
              {r.title}: {r.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}