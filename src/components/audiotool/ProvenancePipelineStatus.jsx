import { Loader2, CheckCircle2, XCircle, Circle, MinusCircle, ExternalLink } from 'lucide-react';
import useProvenancePipeline from '@/hooks/useProvenancePipeline';

const ICONS = {
  done: <CheckCircle2 className="w-4 h-4 text-emerald-300" />,
  active: <Loader2 className="w-4 h-4 animate-spin text-accent" />,
  failed: <XCircle className="w-4 h-4 text-destructive" />,
  skipped: <MinusCircle className="w-4 h-4 text-muted-foreground" />,
  waiting: <Circle className="w-4 h-4 text-muted-foreground" />,
};

function Step({ state, title, detail }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 shrink-0">{ICONS[state]}</span>
      <div className="min-w-0">
        <p className={state === 'waiting' ? 'text-muted-foreground' : 'font-medium'}>{title}</p>
        {detail && <div className="text-xs text-muted-foreground break-all">{detail}</div>}
      </div>
    </li>
  );
}

// Pass `pipeline` when the parent already polls this asset, to avoid a second poll loop.
export default function ProvenancePipelineStatus({ assetId, pipeline }) {
  const own = useProvenancePipeline(pipeline ? null : assetId);
  const { asset, stages } = pipeline || own;
  const { watermark, sealed, anchor, seal, v2Error } = stages;
  const tx = asset?.chain_tx_hash;

  return (
    <ol className="space-y-3 text-sm rounded-xl border border-border p-4">
      <Step state={watermark} title="Watermarking (V1 + V2 Cascade)"
        detail={watermark === 'failed' ? v2Error : watermark === 'active' ? 'Neural layer runs on a GPU — this can take a few minutes.' : null} />
      <Step state={sealed} title="C2PA Sealed"
        detail={sealed === 'done'
          ? <>Signed (developer test certificate) · ownership score {seal?.cos?.score} · hash {asset?.c2pa_provenance_hash}</>
          : sealed === 'failed' ? 'Not sealed — the watermark cascade did not complete.' : null} />
      <Step state={anchor} title="Anchored on Base Mainnet"
        detail={tx ? (
          <a href={`https://basescan.org/tx/${tx}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
            {tx.slice(0, 10)}…{tx.slice(-8)} <ExternalLink className="w-3 h-3" />
          </a>
        ) : anchor === 'skipped' ? 'Not registered — automatic registration is off.'
          : anchor === 'failed' ? 'The transaction did not go through; it can be retried from Proof of Ownership.' : null} />
    </ol>
  );
}