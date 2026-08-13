import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Library, Loader2, X, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import LibraryAssetModal from './LibraryAssetModal';
import { kindFromFile, kindFromUrl } from '@/lib/video/assetKind';

/**
 * Lets one storyboard scene use the creator's own footage/image instead of a
 * Pexels stock query — from an upload, the library, or an external URL.
 * onSet({ src, mediaKind, mediaLabel }) / onClear()
 */
export default function SceneMediaSource({ src, mediaKind, mediaLabel, onSet, onClear }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const kind = kindFromFile(file);
      onSet({ src: file_url, mediaKind: kind === 'audio' ? 'video' : kind, mediaLabel: file.name });
    } catch (err) { toast.error(err.message); }
    setUploading(false);
  };

  if (src) {
    return (
      <div className="flex items-center gap-2 pl-8">
        <Badge variant="outline" className="text-xs capitalize">{mediaKind || 'video'}</Badge>
        <span className="text-xs text-muted-foreground truncate flex-1">{mediaLabel || src}</span>
        <button type="button" onClick={onClear} className="text-muted-foreground hover:text-rose-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="pl-8 space-y-1.5">
      <div className="flex gap-1.5 flex-wrap">
        <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={upload} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="px-2 py-1 rounded-md text-[10px] font-bold bg-muted text-muted-foreground hover:bg-indigo-500/20 hover:text-indigo-300 inline-flex items-center gap-1">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload media
        </button>
        <button type="button" onClick={() => setLibraryOpen(true)}
          className="px-2 py-1 rounded-md text-[10px] font-bold bg-muted text-muted-foreground hover:bg-indigo-500/20 hover:text-indigo-300 inline-flex items-center gap-1">
          <Library className="w-3 h-3" /> From library
        </button>
        <button type="button" onClick={() => setUrlOpen(o => !o)}
          className="px-2 py-1 rounded-md text-[10px] font-bold bg-muted text-muted-foreground hover:bg-indigo-500/20 hover:text-indigo-300 inline-flex items-center gap-1">
          <Link2 className="w-3 h-3" /> URL
        </button>
      </div>

      {urlOpen && (
        <div className="flex gap-2">
          <Input value={urlDraft} onChange={e => setUrlDraft(e.target.value)}
            placeholder="https://…mp4 or .jpg" className="text-xs" />
          <Button size="sm" className="rounded-lg bg-indigo-600 hover:bg-indigo-500"
            onClick={() => {
              const v = urlDraft.trim();
              if (!v) return;
              const kind = kindFromUrl(v);
              onSet({ src: v, mediaKind: kind === 'audio' ? 'video' : kind, mediaLabel: v });
              setUrlDraft(''); setUrlOpen(false);
            }}>Use</Button>
        </div>
      )}

      <LibraryAssetModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        only={['video', 'image']}
        title="Pick footage or an image for this scene"
        onPick={(kind, url, label) => onSet({ src: url, mediaKind: kind, mediaLabel: label })}
      />
    </div>
  );
}