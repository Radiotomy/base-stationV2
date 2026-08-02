import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { renderMixdown } from '@/utils/renderMixdown';

/**
 * Renders the mix to a real WAV, saves it as a master, and marks it.
 *
 * V1 (spectral) is applied here directly because the mixdown is genuine PCM.
 * V2 (neural) then fires automatically off the new audio asset, so the finished
 * record carries the full cascade without the user doing anything.
 */
export default function MixdownButton({ tracks, onDone }) {
  const [stage, setStage] = useState(null);

  const run = async () => {
    if (!tracks.length) return;
    try {
      setStage('Mixing down…');
      const { blob, duration_seconds, sample_rate } = await renderMixdown(tracks);

      setStage('Uploading…');
      const title = `Mixdown — ${new Date().toLocaleDateString()}`;
      const file = new File([blob], `${title.replace(/[^\w.\-]/g, '_')}.wav`, { type: 'audio/wav' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const user = await base44.auth.me();
      const asset = await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'master',
        title,
        file_url,
        is_public: false,
        ai_label: 'ai_assisted',
        metadata: {
          mix_type: 'multitrack_mixdown',
          duration: duration_seconds,
          sample_rate,
          bit_depth: 16,
          source_tracks: tracks.map((t) => ({ name: t.name, url: t.url, volume: t.volume, pan: t.pan })),
        },
      });

      setStage('Applying BASE Mark…');
      const { data } = await base44.functions.invoke('applyBaseMark', { assetId: asset.id });
      if (data?.error) throw new Error(data.error);

      toast.success('Mixdown saved and BASE Marked');
      onDone?.(asset);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStage(null);
    }
  };

  return (
    <Button onClick={run} disabled={!tracks.length || !!stage} className="rounded-xl gap-2">
      {stage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
      {stage || 'Mix Down & Mark'}
    </Button>
  );
}