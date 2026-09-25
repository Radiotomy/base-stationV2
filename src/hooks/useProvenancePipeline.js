import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const POLL_MS = 6000;

// Derives the three Protect & Register stages from the stored asset.
export function deriveStages(asset) {
  const v2 = asset?.metadata?.base_mark_v2?.status;
  const seal = asset?.metadata?.provenance_seal;
  const chain = asset?.chain_status;

  const watermark = v2 === 'completed' ? 'done' : v2 === 'failed' ? 'failed' : 'active';
  const sealed = seal?.status === 'sealed' ? 'done'
    : seal?.status === 'blocked' ? 'failed'
    : watermark === 'done' ? 'active' : 'waiting';
  const anchor = asset?.chain_tx_hash ? 'done'
    : chain === 'failed' ? 'failed'
    : chain === 'skipped' ? 'skipped'
    : chain === 'pending' ? 'active' : 'waiting';

  const finished = ['done', 'failed', 'skipped'].includes(anchor) || sealed === 'failed';
  return { watermark, sealed, anchor, finished, seal, v2Error: asset?.metadata?.base_mark_v2?.error };
}

/** Polls a protected export until it is anchored, skipped or blocked. */
export default function useProvenancePipeline(assetId) {
  const [asset, setAsset] = useState(null);

  useEffect(() => {
    if (!assetId) return undefined;
    let stop = false;
    let timer;
    const tick = async () => {
      const a = await base44.entities.UserAsset.get(assetId);
      if (stop) return;
      setAsset(a);
      if (deriveStages(a).finished) return;
      // Nudge the V2 finalizer in case the provider webhook is late; idempotent.
      if (a?.metadata?.base_mark_v2?.prediction_id && a.metadata.base_mark_v2.status === 'processing') {
        base44.functions.invoke('pollBaseMarkV2', { assetId }).catch(() => {});
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [assetId]);

  return { asset, stages: deriveStages(asset) };
}