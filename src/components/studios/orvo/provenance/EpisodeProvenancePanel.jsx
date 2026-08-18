import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { ShieldCheck, Loader2, Fingerprint } from 'lucide-react';
import EpisodeChainAnchor from './EpisodeChainAnchor';
import ForeignProvenanceCard from './ForeignProvenanceCard';
import AdvisoryReviewCard from './AdvisoryReviewCard';
import C2paCredentialsCard from './C2paCredentialsCard';

const LABELS = {
  human: 'Human recorded',
  ai_assisted: 'AI assisted',
  ai_generated: 'AI generated',
  unverified: 'Origin unverified',
};

export default function EpisodeProvenancePanel({ episode, onUpdate }) {
  const { toast } = useToast();
  const [asset, setAsset] = useState(null);
  const [busy, setBusy] = useState(false);

  // Marking finishes asynchronously on Replicate, so poll until it settles.
  useEffect(() => {
    const assetId = episode.base_mark_asset_id;
    if (!assetId) return;
    let alive = true;
    let timer;

    const sync = async () => {
      const rows = await base44.entities.UserAsset.filter({ id: assetId });
      let a = rows?.[0];
      if (!alive || !a) return;
      // Actively finalize: if the neural embed is in flight, poll Replicate
      // server-side so a missed webhook can never strand an episode in
      // "processing" forever.
      const inflight = a.metadata?.base_mark_v2;
      if (inflight?.status === 'processing' && inflight.prediction_id) {
        const res = await base44.functions.invoke('pollBaseMarkV2', { assetId }).catch(() => null);
        if (res?.data?.status && res.data.status !== 'processing') {
          const fresh = await base44.entities.UserAsset.filter({ id: assetId });
          a = fresh?.[0] || a;
        }
      }
      if (!alive) return;
      setAsset(a);
      const v2 = a.metadata?.base_mark_v2?.status;
      const next = v2 === 'completed' ? 'marked' : v2 === 'failed' ? 'failed' : 'processing';
      if (next !== episode.provenance_status) {
        const updated = await base44.entities.Episode.update(episode.id, { provenance_status: next });
        onUpdate?.(updated);
      }
      if (alive && next === 'processing') timer = setTimeout(sync, 15000);
    };
    sync();

    return () => { alive = false; clearTimeout(timer); };
  }, [episode.base_mark_asset_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const register = async (retry = false) => {
    setBusy(true);
    const res = await base44.functions.invoke('registerEpisodeProvenance', {
      episode_id: episode.id,
      ...(retry ? { action: 'retry' } : {}),
    });
    setBusy(false);
    if (res.data?.error) return toast({ title: 'Could not register', description: res.data.error, variant: 'destructive' });
    toast({ title: 'BASE Mark started', description: 'Forensic marking runs in the background.' });
    onUpdate?.(res.data.episode);
  };

  const status = episode.provenance_status || 'unregistered';
  const mark = asset?.metadata?.base_mark_v2 || asset?.metadata?.base_mark;

  return (
    <div className="merc-card rounded-2xl p-5 mt-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D] mb-3 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5" /> Provenance
      </p>

      {status === 'unregistered' ? (
        <>
          <p className="text-sm text-white/60 mb-4">
            Register this episode to embed its BASE Mark forensic watermark and lock in a Creative Ownership Score.
          </p>
          <button onClick={() => register()} disabled={busy} className="merc-button rounded-full px-5 py-2 text-sm font-black flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />} Register provenance
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
              status === 'marked'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : status === 'failed'
                ? 'bg-red-500/15 text-red-300 border-red-500/40'
                : 'bg-white/10 text-white/60 border-white/20'
            }`}>
              {status === 'marked' ? 'BASE Marked' : status === 'failed' ? 'Marking failed' : 'Marking in progress'}
            </span>
            {episode.ai_disclosure_label && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FF9A4D]/15 text-[#FF9A4D] border border-[#FF9A4D]/30">
                {LABELS[episode.ai_disclosure_label] || episode.ai_disclosure_label}
              </span>
            )}
          </div>

          {typeof episode.human_participation_score === 'number' && (
            <div>
              <div className="flex justify-between text-xs text-white/50 mb-1">
                <span>Creative Ownership Score</span>
                <span className="text-white font-bold">{episode.human_participation_score}/100</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full merc-button" style={{ width: `${episode.human_participation_score}%` }} />
              </div>
            </div>
          )}

          {episode.ai_disclosure_basis && (
            <p className="text-xs text-white/40">{episode.ai_disclosure_basis}</p>
          )}

          {mark?.payload_hex && (
            <p className="text-[11px] text-white/35 font-mono break-all">Mark ID · {mark.payload_hex}</p>
          )}

          {status === 'failed' && (
            <button onClick={() => register(true)} disabled={busy} className="merc-button rounded-full px-5 py-2 text-sm font-black flex items-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />} Retry BASE Mark
            </button>
          )}

          <ForeignProvenanceCard episode={episode} onUpdate={onUpdate} />

          <C2paCredentialsCard episode={episode} onUpdate={onUpdate} />

          <AdvisoryReviewCard episode={episode} onUpdate={onUpdate} />

          <EpisodeChainAnchor episode={episode} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}