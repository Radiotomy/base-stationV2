import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AssetPicker from '@/components/studio/AssetPicker';

/**
 * Standalone manager for a venue's Always-On Showcase — the video/audio
 * content that loops on the 3D room's stage wall whenever the artist
 * isn't live. Works from Live Manager without opening Live Studio.
 */
export default function ShowcaseManagerDialog({ session, open, onOpenChange, onSaved }) {
  const [contentType, setContentType] = useState('video');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showcaseTitle, setShowcaseTitle] = useState(session?.showcase_video_title || '');

  const setShowcase = async () => {
    const id = selected[0];
    if (!id) { toast.error('Pick a video first'); return; }
    setBusy(true);
    try {
      const rows = await base44.entities.UserAsset.filter({ id });
      const asset = rows[0];
      if (!asset?.file_url) throw new Error('Video file not found');
      await base44.functions.invoke('createPortalRoom', {
        action: 'set_screen_video',
        sessionId: session.id,
        videoUrl: asset.file_url,
        videoTitle: asset.title || '',
        isShowcase: true,
      });
      setShowcaseTitle(asset.title || 'Showcase');
      setSelected([]);
      onSaved?.();
      toast.success('🎬 Always-On Showcase set — it loops whenever you\'re not live');
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
        sessionId: session.id,
        videoUrl: '',
        clearShowcase: true,
      });
      setShowcaseTitle('');
      onSaved?.();
      toast.success('Always-On Showcase removed');
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-fuchsia-400" /> Venue Showcase — {session?.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            This content loops on your 3D venue's stage wall whenever you're not live —
            visualizers include your track's audio, so the room always has music playing.
          </p>

          {showcaseTitle && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20">
              <p className="text-xs text-fuchsia-300 flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Currently showing: {showcaseTitle}</span>
              </p>
              <button type="button" onClick={removeShowcase} disabled={busy}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 flex-shrink-0">
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          )}

          <div className="flex gap-2">
            {[['video', 'Music Videos'], ['visualizer', 'Visualizers']].map(([type, label]) => (
              <button key={type} onClick={() => { setContentType(type); setSelected([]); }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  contentType === type ? 'bg-fuchsia-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <AssetPicker key={contentType} assetType={contentType} selected={selected} onChange={setSelected} />

          <Button onClick={setShowcase} disabled={busy || !selected.length} className="w-full rounded-xl font-bold gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {busy ? 'Updating venue…' : 'Set as Always-On Showcase'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}