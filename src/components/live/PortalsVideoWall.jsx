import { useState, useEffect } from 'react';
import { Film, Loader2, Upload, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import AssetPicker from '@/components/studio/AssetPicker';

/**
 * Push an MP4 / video from the creator's library onto the 3D venue's
 * stage video wall. Supports an Always-On Showcase: a default video that
 * keeps playing in the venue whenever the artist isn't live performing,
 * and is auto-restored when the live show ends.
 */
export default function PortalsVideoWall({ sessionId }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [activeTitle, setActiveTitle] = useState('');
  const [asShowcase, setAsShowcase] = useState(false);
  const [showcaseTitle, setShowcaseTitle] = useState('');

  // Load any existing Always-On Showcase from the session
  useEffect(() => {
    if (!sessionId) return;
    base44.entities.LiveSession.filter({ id: sessionId })
      .then(rows => {
        const s = rows[0];
        if (s?.showcase_video_url) setShowcaseTitle(s.showcase_video_title || 'Showcase');
      })
      .catch(() => {});
  }, [sessionId]);

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
        isShowcase: asShowcase,
      });
      setActiveTitle(asset.title || 'Video');
      if (asShowcase) setShowcaseTitle(asset.title || 'Showcase');
      setOpen(false);
      toast.success(asShowcase
        ? '🎬 Always-On Showcase set — it plays whenever you\'re not live'
        : '🎬 Video is now playing on the venue wall');
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  const clearVideo = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('createPortalRoom', {
        action: 'set_screen_video',
        sessionId,
        videoUrl: '',
      });
      setActiveTitle('');
      setSelected([]);
      toast.success(res?.data?.showcaseActive
        ? 'Back to your Always-On Showcase'
        : 'Video wall cleared — cover art restored');
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  const removeShowcase = async () => {
    setBusy(true);
    try {
      await base44.functions.invoke('createPortalRoom', {
        action: 'set_screen_video',
        sessionId,
        videoUrl: '',
        clearShowcase: true,
      });
      setShowcaseTitle('');
      setActiveTitle('');
      toast.success('Always-On Showcase removed');
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

      {showcaseTitle && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20">
          <p className="text-[10px] text-fuchsia-300 flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Always-On: {showcaseTitle}</span>
          </p>
          <button type="button" onClick={removeShowcase} disabled={busy}
            className="text-[10px] text-muted-foreground hover:text-foreground flex-shrink-0">
            Remove
          </button>
        </div>
      )}

      {open && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Pick a video from your library — it plays on the big screen above your 3D stage.
          </p>
          <AssetPicker assetType="video" selected={selected} onChange={setSelected} />
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={asShowcase} onCheckedChange={v => setAsShowcase(!!v)} />
            <span className="text-[11px] text-foreground font-medium">
              Set as Always-On Showcase
              <span className="text-muted-foreground font-normal"> — keeps playing whenever you're not live</span>
            </span>
          </label>
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