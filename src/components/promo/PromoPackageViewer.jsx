import { Download, ImageIcon, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MilkdropVisualizer from '@/components/studio/MilkdropVisualizer';
import ProvenancePanel from '@/components/studio/ProvenancePanel';
import AddToProjectButton from '@/components/studio/AddToProjectButton';

/**
 * Unified promo package: track + reactive visualizer + promo card in one bundle.
 * Downloads: recorded visualizer video (via record button on the player),
 * the track audio, and the promo card image.
 */
export default function PromoPackageViewer({ visualizerAsset, cardUrl, preset }) {
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-bold truncate">{visualizerAsset.title}</p>
          <div className="flex items-center gap-2">
            <a href={visualizerAsset.file_url} target="_blank" rel="noopener noreferrer" download>
              <Button size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs">
                <Music className="w-3.5 h-3.5" /> Track
              </Button>
            </a>
            <a href={cardUrl} target="_blank" rel="noopener noreferrer" download>
              <Button size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Card
              </Button>
            </a>
            <AddToProjectButton asset={visualizerAsset} tool="promo_studio" toolRoute="/promo-studio" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <MilkdropVisualizer
              src={visualizerAsset.file_url}
              presetName={visualizerAsset.metadata?.milkdrop_preset || visualizerAsset.metadata?.visualizer_style || preset}
              title={visualizerAsset.title}
              enableRecording
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              🎥 While playing, hit the record button on the player to capture and download the visualizer as a video (with audio).
            </p>
          </div>
          <div>
            <div className="rounded-xl overflow-hidden border border-border bg-black/30">
              <img src={cardUrl} alt="Promo card" className="w-full object-contain max-h-[320px]" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
              <ImageIcon className="w-3 h-3 text-orange-400" /> Promo song card — linked to this track & visualizer.
            </p>
          </div>
        </div>
      </div>

      <ProvenancePanel asset={visualizerAsset} />
    </div>
  );
}