import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { BadgeCheck, Loader2 } from 'lucide-react';

const ACTION_LABELS = {
  'c2pa.created': 'Created',
  'c2pa.edited': 'Edited',
  'c2pa.converted': 'Converted',
  'c2pa.opened': 'Opened',
  'c2pa.placed': 'Placed',
  'c2pa.transcoded': 'Transcoded',
  'c2pa.repackaged': 'Repackaged',
  'c2pa.filtered': 'Filtered',
  'c2pa.drawing': 'Drawing',
};

// Whether the bytes examined were the creator's original upload or a copy this
// platform had already processed decides whether the finding says anything
// about the source at all — so it is always stated, never implied.
function SourceStateNote({ scan }) {
  if (!scan.source_state) return null;
  const original = scan.source_state === 'original_upload';
  return (
    <p className={`text-[10px] ${original ? 'text-emerald-300/70' : 'text-amber-300/70'}`}>
      {original
        ? 'Read from the original upload, before BASE Mark processing.'
        : 'Read from a BASE Mark–processed copy — describes this platform\'s output, not the source file.'}
    </p>
  );
}

export default function C2paCredentialsCard({ episode, onUpdate }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const scan = episode.c2pa_provenance;

  const run = async () => {
    setBusy(true);
    const res = await base44.functions.invoke('scanC2paManifest', { episode_id: episode.id });
    setBusy(false);
    if (res.data?.error) {
      return toast({ title: 'Scan failed', description: res.data.error, variant: 'destructive' });
    }
    if (res.data?.preserved) {
      return toast({ title: 'Original scan kept', description: res.data.note });
    }
    onUpdate?.(res.data.episode);
  };

  const claims = scan?.claims || {};

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 mt-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2">
        <BadgeCheck className="w-3.5 h-3.5" /> Content Credentials (C2PA)
      </p>

      {!scan ? (
        <>
          <p className="text-xs text-white/40 mb-3">
            Read any Content Credentials manifest attached to this audio — the tool that wrote it, the actions it declared, and the files it was assembled from.
          </p>
          <button onClick={run} disabled={busy} className="merc-button-dark rounded-full px-4 py-1.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />} Scan Content Credentials
          </button>
        </>
      ) : !scan.present ? (
        <div className="space-y-2">
          <p className="text-xs text-white/50">{scan.summary}</p>
          <SourceStateNote scan={scan} />
          <button onClick={run} disabled={busy} className="text-[11px] text-[#FF9A4D] hover:underline disabled:opacity-50">
            {busy ? 'Re-scanning…' : 'Re-scan'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-white/70">{scan.summary}</p>

          {claims.claim_generator && (
            <div className="text-xs">
              <span className="text-white/40">Written by </span>
              <span className="text-white/80 font-mono text-[11px]">{claims.claim_generator}</span>
            </div>
          )}

          {claims.actions?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {claims.actions.map((a) => (
                <span key={a} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/15">
                  {ACTION_LABELS[a] || a}
                </span>
              ))}
            </div>
          )}

          {claims.generative_indicators?.length > 0 && (
            <p className="text-[11px] text-[#FF9A4D]">
              Manifest declares generative source: {claims.generative_indicators.join(', ')}
            </p>
          )}

          {claims.software_agents?.length > 0 && (
            <p className="text-[11px] text-white/50">
              Software: <span className="font-mono text-white/70">{claims.software_agents.join(' · ')}</span>
            </p>
          )}

          {claims.ingredient_count > 0 && (
            <div className="text-[11px] text-white/50">
              Ingredient chain: {claims.ingredient_count} source file(s)
              {claims.ingredient_titles?.length > 0 && (
                <span className="text-white/70 font-mono"> — {claims.ingredient_titles.join(', ')}</span>
              )}
            </div>
          )}

          <SourceStateNote scan={scan} />
          <p className="text-[10px] text-white/30 leading-relaxed">{scan.caveat}</p>
          <button onClick={run} disabled={busy} className="text-[11px] text-[#FF9A4D] hover:underline disabled:opacity-50">
            {busy ? 'Re-scanning…' : 'Re-scan'}
          </button>
        </div>
      )}
    </div>
  );
}