import { Badge } from '@/components/ui/badge';
import { Fingerprint, Hash } from 'lucide-react';
import ParticipationBadge from '@/components/music/ParticipationBadge';
import AiDisclosureBadge from '@/components/music/AiDisclosureBadge';
import ProvenanceManifestCard from '@/components/music/ProvenanceManifestCard';
import RightsActions from '@/components/rights/RightsActions';

export default function RightsAssetRow({ asset, manifestOpen, onToggleManifest }) {
  const marked = !!asset.metadata?.base_mark?.payload_hex;
  return (
    <div>
      <div className="p-3 rounded-xl bg-card border border-border flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <ParticipationBadge item={asset} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{asset.title}</p>
          <p className="text-[11px] text-muted-foreground capitalize">
            {asset.asset_type} · {new Date(asset.created_date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <AiDisclosureBadge item={asset} />
          {marked && (
            <Badge variant="outline" className="gap-1 text-[10px] text-emerald-400 border-emerald-500/30" title={`BASE Mark ${asset.metadata.base_mark.payload_hex}`}>
              <Fingerprint className="w-3 h-3" /> Marked
            </Badge>
          )}
          {asset.c2pa_provenance_hash && (
            <Badge variant="outline" className="gap-1 text-[10px] text-cyan-400 border-cyan-500/30" title="Cryptographic manifest hash anchored">
              <Hash className="w-3 h-3" /> Anchored
            </Badge>
          )}
        </div>
        <RightsActions asset={asset} manifestOpen={manifestOpen} onToggleManifest={onToggleManifest} />
      </div>
      {manifestOpen && (
        <div className="mt-2 mb-3 pl-2 sm:pl-8">
          <ProvenanceManifestCard asset={asset} />
        </div>
      )}
    </div>
  );
}