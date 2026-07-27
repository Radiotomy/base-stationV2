import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Upload, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LoopCard from './LoopCard';

const CATEGORY_OPTIONS = ['loop', 'one_shot', 'drum_loop', 'bass_loop', 'melodic_loop', 'vocal_chop', 'fx', 'sample'];

export default function MyLoopsTab() {
  const [loops, setLoops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [category, setCategory] = useState('loop');
  const [makePublic, setMakePublic] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      const mine = await base44.entities.LoopSample.filter({ user_id: me.id }, '-created_date', 200);
      setLoops(mine);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const me = await base44.auth.me();
      const created = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        created.push({
          user_id: me.id,
          user_name: me.full_name,
          title: file.name.replace(/\.[^.]+$/, ''),
          file_url,
          category,
          source: 'upload',
          collection_name: collectionName || 'Uploads',
          license: 'User Upload',
          is_public: makePublic,
        });
      }
      await base44.entities.LoopSample.bulkCreate(created);
      toast.success(`Uploaded ${created.length} sound${created.length > 1 ? 's' : ''}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (e) {
      toast.error('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    await base44.entities.LoopSample.delete(id);
    setLoops((prev) => prev.filter((l) => l.id !== id));
  };

  const groups = loops.reduce((acc, l) => {
    const key = l.collection_name || 'Uploads';
    (acc[key] = acc[key] || []).push(l);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="merc-card rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Upload loops & samples</p>
        <p className="text-xs text-muted-foreground">
          Upload single files or select many at once for a batch (e.g. a whole CD collection).
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <Input placeholder="Collection name (e.g. CD Vol 1)" value={collectionName} onChange={(e) => setCollectionName(e.target.value)} />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={makePublic} onChange={(e) => setMakePublic(e.target.checked)} />
            Share to community library
          </label>
        </div>
        <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
          {uploading ? 'Uploading…' : 'Choose file(s) to upload'}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading your loops…</p>
      ) : loops.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No loops yet — upload your first sound above.</p>
      ) : (
        Object.entries(groups).map(([name, items]) => (
          <div key={name} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">{name} ({items.length})</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((l) => (
                <LoopCard
                  key={l.id}
                  title={l.title}
                  subtitle={l.category}
                  audioUrl={l.file_url}
                  tags={l.tags}
                  license={l.license}
                  attribution={l.attribution}
                  onAction={() => remove(l.id)}
                  actionLabel="Delete"
                  actionIcon={Trash2}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}