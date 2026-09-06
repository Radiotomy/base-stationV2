import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Radar, Loader2 } from 'lucide-react';
import SweepFindingRow from './SweepFindingRow';

// Runs the sweep in small batches and shows everything it examined — not only
// the hits. A list of hits alone could never distinguish "we looked and found
// nothing" from "we never looked", and the second is not an all-clear.
export default function AudiusSweepPanel({ refreshKey }) {
  const [findings, setFindings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    base44.entities.AudiusSweepFinding.list('-created_date', 60).then(setFindings);

  useEffect(() => { load(); }, [refreshKey]);

  const run = async (dryRun) => {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const res = await base44.functions.invoke('sweepAudiusForMarks', { batchSize: 3, dryRun });
      if (res.data?.ok) setSummary(res.data);
      else setError(res.data?.error || 'The sweep could not run.');
      if (!dryRun) await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const hits = (findings || []).filter((f) => f.match_status === 'resembles_registered_work');

  return (
    <div className="space-y-4">
      <div className="merc-card rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Radar className="w-4 h-4 text-[#FF9A4D]" /> Audius sweep
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Walks public Audius releases and checks whether any of them acoustically resemble a work
              registered here. Audius serves MP3, which this runtime cannot decode, so extraction runs in
              the BASE Print container. Each track costs one extraction, so runs are small and repeatable —
              already-scanned tracks are never re-paid for.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={() => run(true)} disabled={busy} size="sm" variant="outline">
              Preview queue
            </Button>
            <Button onClick={() => run(false)} disabled={busy} size="sm" className="merc-button">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan 3 tracks'}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive mt-3">{error}</p>
        )}

        {summary?.dry_run && (
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <p>
              {summary.references} references · {summary.candidates_available} trending ·{' '}
              {summary.already_scanned} already scanned · {summary.own_releases_skipped} of ours skipped
            </p>
            {(summary.would_scan || []).map((w) => (
              <p key={w.id} className="font-mono text-[11px]">{w.title} — @{w.handle}</p>
            ))}
            {!summary.would_scan?.length && <p>Nothing new in trending to scan right now.</p>}
          </div>
        )}

        {summary && !summary.dry_run && (
          <p className="text-xs text-muted-foreground mt-3">
            Scanned {summary.scanned} · {summary.resembles} resembling · {summary.no_match} clear ·{' '}
            {summary.not_scannable} unreadable
          </p>
        )}
      </div>

      {hits.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
          <p className="text-xs text-amber-200">
            {hits.length} track{hits.length === 1 ? '' : 's'} resemble a registered work. Resemblance is not
            proof — confirm with a BASE Mark recovery before contacting anyone.
          </p>
        </div>
      )}

      {findings === null ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
        </div>
      ) : findings.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nothing examined yet. Build reference prints, then run a scan.
        </p>
      ) : (
        <div className="space-y-2">
          {findings.map((f) => <SweepFindingRow key={f.id} finding={f} />)}
        </div>
      )}
    </div>
  );
}