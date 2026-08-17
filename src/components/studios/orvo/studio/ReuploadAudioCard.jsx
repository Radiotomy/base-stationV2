import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { uploadToPinata, extractAudioDuration } from '@/lib/studios/orvo/pinataUpload';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw } from 'lucide-react';

/**
 * Owner-only "re-upload audio" action. Replaces this episode's audio in place —
 * re-pins to IPFS, keeps a reliable stored copy, and re-runs BASE Mark —
 * without creating a duplicate episode.
 */
export default function ReuploadAudioCard({ episode, onUpdate }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const duration = await extractAudioDuration(file);
      const [{ cid, gateway_url }, storageUpload] = await Promise.all([
        uploadToPinata(file, `${episode.title}-audio`),
        base44.integrations.Core.UploadFile({ file }).catch(() => null),
      ]);
      const patch = {
        audio_url: gateway_url,
        storage_audio_url: storageUpload?.file_url || undefined,
        ipfs_hash: cid,
        duration_seconds: duration || undefined,
        provenance_status: 'unregistered',
        base_mark_asset_id: undefined,
      };
      await base44.entities.Episode.update(episode.id, patch);
      onUpdate?.({ ...episode, ...patch });
      base44.functions.invoke('registerEpisodeProvenance', { episode_id: episode.id }).catch(() => {});
      toast({ title: 'Audio replaced', description: 'BASE Mark registration restarted for this episode.' });
    } catch (err) {
      toast({ title: 'Re-upload failed', description: err.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <div className="merc-card rounded-2xl p-5 mt-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">Re-upload audio</p>
          <p className="text-xs text-white/50 mt-0.5">
            Replaces this episode's audio file in place and re-runs BASE Mark. No duplicate episode is created.
          </p>
        </div>
        <label className="merc-button-dark rounded-full px-5 py-2 text-sm font-bold cursor-pointer flex items-center gap-2 flex-shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {busy ? 'Uploading…' : 'Choose file'}
          <input type="file" accept="audio/*" className="hidden" onChange={handleFile} disabled={busy} />
        </label>
      </div>
    </div>
  );
}