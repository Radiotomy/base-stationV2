import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { UploadCloud, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { kindFromFile } from '@/lib/video/assetKind';

/** Uploads a local video / audio / image file and adds it to the timeline. */
export default function TimelineUploadDrop({ onUploaded, disabled }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUploaded(kindFromFile(file), file_url, file.name);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
    setBusy(false);
  };

  return (
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handle(e.dataTransfer.files?.[0]); }}
      className="border-2 border-dashed border-border rounded-xl p-6 text-center space-y-3"
    >
      <UploadCloud className="w-7 h-7 mx-auto text-indigo-400" />
      <p className="text-sm text-muted-foreground">
        Drop a video, audio or image file here — or pick one from your device.
      </p>
      <input ref={inputRef} type="file" accept="video/*,audio/*,image/*" className="hidden"
        onChange={e => handle(e.target.files?.[0])} />
      <Button variant="outline" className="rounded-xl gap-2" disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}>
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : 'Choose File'}
      </Button>
    </div>
  );
}