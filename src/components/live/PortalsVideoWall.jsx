import { useState } from 'react';
import { Film, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import AssetPicker from '@/components/studio/AssetPicker';

/**
 * Push an MP4 / video from the creator's library onto the 3D venue's
 * stage video wall. Empty selection clears the wall (restores cover art).
 */
export default function PortalsVideoWall({ sessionId }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [activeTitle, setActiveTitle] = useState('');

  const pushVideo = async () => {
    const id = selected[0];
    if (!id) { toast.error('Pick a video first'); return; }
    setBusy(true);
    try {
      const rows = await base44.entities.UserAsset.filter({ id });
      const asset = rows[0];
      if (!asset?.file_url) throw new Error('Video file not found');
      await base44.functions.invoke('createPortalRoom', {
        action: 'set_screen_video',
        sessionId,
        videoUrl: asset.file_url,
        videoTitle: asset.title || '',
      });
      setActiveTitle(asset.title || 'Video');
      setOpen(false);
      toast.success('🎬 Video is now playing on the venue wall');
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  const clearVideo = async () => {
    setBusy(true);
    try {
      await base44.functions.invoke('createPortalRoom', {
        action: 'set_screen_video',
        sessionId,
        videoUrl: '',
      });
      setActiveTitle('');
      setSelected([]);
      toast.success('Video wall cleared — cover art restored');
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(o => !o)} disabled={busy}
          className="rounded-lg h-8 gap-1.5 text-xs flex-1">
          <Film className="w-3.5 h-3.5" />
          {activeTitle ? `Wall: ${activeTitle}` : 'Video Wall'}
        </Button>
        {activeTitle && (
          <Button size="sm" variant="outline" onClick={clearVideo} disabled={busy}
            className="rounded-lg h-8 gap-1.5 text-xs">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Pick a video from your library — it plays on the big screen above your 3D stage.
          </p>
          <AssetPicker assetType="video" selected={selected} onChange={setSelected} />
          <Button size="sm" onClick={pushVideo} disabled={busy || !selected.length}
            className="w-full rounded-lg h-8 gap-1.5 text-xs font-bold">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {busy ? 'Sending to stage…' : 'Play on Video Wall'}
          </Button>
        </div>
      )}
    </div>
  );
}