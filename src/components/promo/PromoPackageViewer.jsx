import { Download, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MilkdropVisualizer from '@/components/studio/MilkdropVisualizer';
import ProvenancePanel from '@/components/studio/ProvenancePanel';
import AddToProjectButton from '@/components/studio/AddToProjectButton';

/**
 * Unified promo package playback: track + reactive visualizer + promo card.
 */
export default function PromoPackageViewer({ visualizerAsset, cardUrl, preset }) {
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-bold truncate">{visualizerAsset.title}</p>
          <AddToProjectButton asset={visualizerAsset} tool="promo_studio" toolRoute="/promo-studio" />
        </div>
        <MilkdropVisualizer
          src={visualizerAsset.file_url}
          presetName={visualizerAsset.metadata?.visualizer_style || preset}
          title={visualizerAsset.title}
        />
      </div>

      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-orange-400" /> Promo Song Card
          </p>
          <a href={cardUrl} target="_blank" rel="noopener noreferrer" download>
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
          </a>
        </div>
        <img src={cardUrl} alt="Promo card" className="w-full max-h-[480px] object-contain rounded-xl border border-border bg-black/30" />
      </div>

      <ProvenancePanel asset={visualizerAsset} />
    </div>
  );
}