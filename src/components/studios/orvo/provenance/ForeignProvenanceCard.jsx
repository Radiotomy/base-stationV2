import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { FileSearch, Loader2 } from 'lucide-react';

const FIELD_LABELS = {
  machine_originator: 'Originating workstation',
  originator_reference: 'Originator reference',
  encoder_software: 'Software / encoder',
  encoded_by: 'Encoded by',
  encoder_build: 'Encoder build',
  origination_date: 'Originated',
  coding_history: 'Coding history',
  vendor_string: 'Vendor',
};

export default function ForeignProvenanceCard({ episode, onUpdate }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const scan = episode.external_provenance;

  const run = async () => {
    setBusy(true);
    const res = await base44.functions.invoke('scanForeignProvenance', { episode_id: episode.id });
    setBusy(false);
    if (res.data?.error) {
      return toast({ title: 'Scan failed', description: res.data.error, variant: 'destructive' });
    }
    onUpdate?.(res.data.episode);
  };

  const entries = Object.entries(scan?.observations || {});

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 mt-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2">
        <FileSearch className="w-3.5 h-3.5" /> Source file evidence
      </p>

      {!scan ? (
        <>
          <p className="text-xs text-white/40 mb-3">
            Read the workstation and software this file declares internally — useful when an episode was produced outside ORVO.
          </p>
          <button onClick={run} disabled={busy} className="merc-button-dark rounded-full px-4 py-1.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSearch className="w-3.5 h-3.5" />} Scan source metadata
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-white/40">
            Container: <span className="text-white/70 font-mono uppercase">{scan.container}</span>
          </p>
          {entries.length ? (
            <dl className="space-y-1.5">
              {entries.map(([k, v]) => (
                <div key={k} className="text-xs">
                  <dt className="text-white/40">{FIELD_LABELS[k] || k}</dt>
                  <dd className="text-white/80 break-words font-mono text-[11px]">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-white/40">{scan.summary}</p>
          )}
          <p className="text-[10px] text-white/30 leading-relaxed">
            Declared by the source file, not verified by BASE Station. This is evidence about the file, not a finding about authorship.
          </p>
          <button onClick={run} disabled={busy} className="text-[11px] text-[#FF9A4D] hover:underline disabled:opacity-50">
            {busy ? 'Re-scanning…' : 'Re-scan'}
          </button>
        </div>
      )}
    </div>
  );
}