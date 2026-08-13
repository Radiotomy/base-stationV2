import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Library, Loader2, X, Image as ImageIcon, Music, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import LibraryAssetModal from './LibraryAssetModal';

/**
 * Reference media input for the LTX studios — the same asset can come from an
 * upload, the user's library, or an external URL.
 * Props: kind 'image' | 'audio', value, onChange(url)
 */
export default function ReferenceMediaInput({ kind, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  const isImage = kind === 'image';
  const Icon = isImage ? ImageIcon : Music;

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
      toast.success(`${isImage ? 'Image' : 'Audio'} uploaded!`);
    } catch (err) { toast.error(err.message); }
    setUploading(false);
  };

  return (
    <div className="p-4 rounded-xl bg-card border border-border space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> Reference {isImage ? 'Image' : 'Audio Track'}
      </p>

      {value ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-emerald-300">{isImage ? 'Image ready' : 'Audio ready'}</p>
            <button type="button" onClick={() => onChange('')} className="text-muted-foreground hover:text-rose-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {isImage
            ? <img src={value} alt="reference" className="w-28 h-28 object-cover rounded-lg" />
            : <audio controls src={value} className="w-full" />}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <label className="cursor-pointer">
              <input type="file" accept={isImage ? 'image/*' : 'audio/*'} onChange={upload} className="hidden" />
              <div className="border-2 border-dashed rounded-xl p-3 text-center border-border hover:border-indigo-500 transition-colors">
                {uploading
                  ? <Loader2 className="w-5 h-5 mx-auto text-indigo-400 animate-spin" />
                  : <><Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">Upload</p></>}
              </div>
            </label>
            <button type="button" onClick={() => setLibraryOpen(true)}
              className="border-2 border-dashed rounded-xl p-3 text-center border-border hover:border-indigo-500 transition-colors">
              <Library className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Library</p>
            </button>
            <button type="button" onClick={() => setUrlOpen(o => !o)}
              className="border-2 border-dashed rounded-xl p-3 text-center border-border hover:border-indigo-500 transition-colors">
              <Link2 className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">URL</p>
            </button>
          </div>

          {urlOpen && (
            <div className="flex gap-2">
              <Input value={urlDraft} onChange={e => setUrlDraft(e.target.value)}
                placeholder={isImage ? 'https://…jpg' : 'https://…mp3'} className="rounded-xl" />
              <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-500"
                onClick={() => { if (urlDraft.trim()) { onChange(urlDraft.trim()); setUrlDraft(''); setUrlOpen(false); } }}>
                Use
              </Button>
            </div>
          )}
        </>
      )}

      <LibraryAssetModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        only={[kind]}
        title={`Pick ${isImage ? 'an image' : 'a track'} from your library`}
        onPick={(_k, url) => onChange(url)}
      />
    </div>
  );
}