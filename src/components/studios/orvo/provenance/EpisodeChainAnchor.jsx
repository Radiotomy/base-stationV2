import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Link2, Loader2, ExternalLink } from 'lucide-react';

// On-chain provenance for an ORVO episode: IPFS pin + Base mainnet anchor.
export default function EpisodeChainAnchor({ episode, onUpdate }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const status = episode.chain_status || 'unregistered';

  const anchor = async () => {
    setBusy(true);
    const res = await base44.functions.invoke('registerEpisodeProvenance', {
      action: 'anchor',
      episode_id: episode.id,
    });
    setBusy(false);
    if (res.data?.error) {
      return toast({ title: 'Anchor failed', description: res.data.error, variant: 'destructive' });
    }
    const chainErr = res.data?.chain?.chain_error;
    toast({
      title: chainErr ? 'Pinned to IPFS — anchor pending' : 'Anchored on Base ⛓️',
      description: chainErr || 'Your episode provenance is now on-chain.',
    });
    onUpdate?.(res.data.episode);
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#FF9A4D]" /> On-chain anchor
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            {status === 'registered'
              ? 'Anchored on Base mainnet · Solana support coming'
              : status === 'pending'
              ? 'Pinned to IPFS — chain anchor pending'
              : 'Pin to IPFS and anchor this episode on Base mainnet.'}
          </p>
        </div>
        {status !== 'registered' && (
          <button onClick={anchor} disabled={busy} className="merc-button rounded-full px-4 py-1.5 text-xs font-black flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            {status === 'pending' ? 'Retry anchor' : 'Anchor on Base'}
          </button>
        )}
      </div>

      {(episode.chain_tx_hash || episode.chain_metadata_uri) && (
        <div className="mt-3 space-y-1 text-[11px]">
          {episode.chain_tx_hash && (
            <a
              href={`https://basescan.org/tx/${episode.chain_tx_hash}`}
              target="_blank" rel="noopener noreferrer"
              className="text-[#FF9A4D] hover:underline flex items-center gap-1 font-mono break-all"
            >
              {episode.chain_tx_hash.slice(0, 18)}… <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {episode.chain_metadata_uri && (
            <p className="text-white/35 font-mono break-all">IPFS · {episode.chain_metadata_uri}</p>
          )}
        </div>
      )}
    </div>
  );
}