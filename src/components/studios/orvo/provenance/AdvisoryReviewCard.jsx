import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { ScanSearch, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const KIND_STYLE = {
  corroborates: { icon: CheckCircle2, cls: 'text-emerald-300' },
  conflicts: { icon: AlertTriangle, cls: 'text-amber-300' },
  context: { icon: Info, cls: 'text-white/40' },
};

const STATUS_LABEL = {
  corroborated: 'Records support the attestation',
  review_suggested: 'Worth a review',
  insufficient_evidence: 'No records to compare',
};

export default function AdvisoryReviewCard({ episode, onUpdate }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState('');
  const review = episode.advisory_review || {};
  const rec = review.reconciliation;
  const tp = review.third_party;

  const run = async (fn, key) => {
    setBusy(key);
    const res = await base44.functions.invoke(fn, { episode_id: episode.id });
    setBusy('');
    if (res.data?.error) {
      return toast({ title: 'Check failed', description: res.data.error, variant: 'destructive' });
    }
    onUpdate?.(res.data.episode);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 mt-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2">
        <ScanSearch className="w-3.5 h-3.5" /> Advisory review
      </p>
      <p className="text-[10px] text-white/30 leading-relaxed mb-3">
        Corroborating evidence only. Nothing here changes the declared origin, the disclosure label or the Ownership Score.
      </p>

      {rec ? (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-white/70 font-bold">{STATUS_LABEL[rec.status] || rec.status}</p>
          <p className="text-xs text-white/40">{rec.summary}</p>
          <ul className="space-y-1.5">
            {(rec.findings || []).map((f, i) => {
              const { icon: Icon, cls } = KIND_STYLE[f.kind] || KIND_STYLE.context;
              return (
                <li key={i} className="flex gap-2 text-[11px] leading-relaxed">
                  <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${cls}`} />
                  <span className="text-white/60">{f.detail}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-white/40 mb-3">
          Compare this episode's declared origin against the creative-process records we already hold.
        </p>
      )}

      {tp && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 mb-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Provider check · {tp.provider}</p>
          <p className="text-xs text-white/70">{tp.summary}</p>
          {tp.analyzed_portion && (
            <p className="text-[10px] text-white/35">Analyzed: {tp.analyzed_portion}</p>
          )}
          <p className="text-[10px] text-white/30 leading-relaxed">{tp.caveat}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run('reconcileEpisodeAttestation', 'rec')}
          disabled={!!busy}
          className="merc-button-dark rounded-full px-4 py-1.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {busy === 'rec' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
          {rec ? 'Re-check records' : 'Check our records'}
        </button>
        <button
          onClick={() => run('detectAiSpeechWatermark', 'tp')}
          disabled={!!busy}
          className="merc-button-dark rounded-full px-4 py-1.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {busy === 'tp' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
          {tp ? 'Re-run provider check' : 'Ask provider about this audio'}
        </button>
      </div>
    </div>
  );
}