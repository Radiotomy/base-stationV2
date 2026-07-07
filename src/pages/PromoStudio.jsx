import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Megaphone, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import StudioPageHeader from '@/components/studio/StudioPageHeader';
import AssetPicker from '@/components/studio/AssetPicker';
import PresetPicker from '@/components/studio/PresetPicker';
import PromoCardOptions from '@/components/promo/PromoCardOptions';
import PromoPackageViewer from '@/components/promo/PromoPackageViewer';
import SavedPromoPackages from '@/components/promo/SavedPromoPackages';
import InfoTip from '@/components/common/InfoTip';

export default function PromoStudio() {
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get('assetId');

  const [selected, setSelected] = useState(preselected ? [preselected] : []);
  const [preset, setPreset] = useState(null);
  const [options, setOptions] = useState({
    template_style: 'dark_moody',
    platform: 'instagram_post',
    tagline: '',
    primary_color: '#FF7A2F',
  });
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState('');
  const [pkg, setPkg] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const openSaved = (asset) => {
    setPkg({ visualizer: asset, cardUrl: asset.metadata.promo_card_url });
  };

  const generate = async () => {
    const assetId = selected[0];
    if (!assetId) { toast.error('Pick a track first'); return; }
    if (!preset) { toast.error('Pick a visualizer preset first'); return; }
    setRunning(true);
    setPkg(null);
    try {
      const user = await base44.auth.me();
      const [track] = await base44.entities.UserAsset.filter({ id: assetId });
      if (!track) throw new Error('Track not found');

      // 1. Generate the track-specific visualizer (reuses Visualizer Studio backend)
      setStage('Rendering visualizer…');
      const vizRes = await base44.functions.invoke('generateVisualizer', { assetId, style: preset, preset });
      const visualizer = vizRes.data?.data?.asset || vizRes.data?.asset;
      if (!visualizer) throw new Error(vizRes.data?.error || 'Visualizer failed');

      // 2. Generate the promo song card (reuses Social Card backend)
      setStage('Designing promo card…');
      const cardRes = await base44.functions.invoke('generateSocialCard', {
        artist_name: track.metadata?.artist_name || user.full_name,
        track_title: track.title,
        genre: track.metadata?.genre || '',
        bio_snippet: options.tagline,
        primary_color: options.primary_color,
        template_style: options.template_style,
        platforms: [options.platform],
      });
      const cardUrl = cardRes.data?.generated_cards?.[options.platform];
      if (!cardUrl) throw new Error(cardRes.data?.error || 'Promo card generation failed');

      // 3. Link everything into one package on the visualizer asset
      setStage('Packaging…');
      const linked = await base44.entities.UserAsset.update(visualizer.id, {
        related_track_id: track.id,
        metadata: {
          ...visualizer.metadata,
          promo_card_url: cardUrl,
          promo_platform: options.platform,
          promo_template: options.template_style,
        },
      });

      setPkg({ visualizer: linked || { ...visualizer, related_track_id: track.id }, cardUrl });
      setRefreshKey(k => k + 1);
      toast.success('Promo package ready!', { icon: '📣' });
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Promo package failed');
    } finally {
      setRunning(false);
      setStage('');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Megaphone} accent="orange"
        title="Promo Package Studio"
        subtitle="Turn any track into a promo package — reactive visualizer + promo song card, in one playback bundle."
        badge="New" />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              1. Track
              <InfoTip text="Pick the track from your library. Its title, artist and genre are pulled into the promo card automatically." />
            </h3>
            <AssetPicker assetType="track" selected={selected} onChange={setSelected} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              2. Visualizer Preset
              <InfoTip text="Real MilkDrop visuals rendered with Butterchurn, reacting to this specific track's audio." />
            </h3>
            <PresetPicker value={preset} onChange={setPreset} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              3. Promo Card
              <InfoTip text="An AI-designed promo song card featuring your track title, artist name and tagline, sized for your chosen platform." />
            </h3>
            <PromoCardOptions options={options} onChange={setOptions} />
          </div>

          <Button onClick={generate} disabled={running || selected.length === 0}
            className="w-full rounded-xl gap-2 font-bold merc-button">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? (stage || 'Working…') : 'Create Promo Package'}
          </Button>

          <SavedPromoPackages onOpen={openSaved} refreshKey={refreshKey} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!pkg && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <Megaphone className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">
                {running ? stage : 'Pick a track, a visualizer preset and card options — the full package renders here.'}
              </p>
            </div>
          )}

          {pkg && (
            <PromoPackageViewer visualizerAsset={pkg.visualizer} cardUrl={pkg.cardUrl} preset={preset} />
          )}
        </div>
      </div>
    </div>
  );
}