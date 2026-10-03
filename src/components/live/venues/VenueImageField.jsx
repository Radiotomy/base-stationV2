import { useRef, useState } from 'react';
import { Upload, Sparkles, Wand2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Image input for venue art: paste a link, upload a file, or generate with AI
// from a typed description or from what's already filled in the form.
// Uploads are public because the Portals 3D client must fetch them directly.
export default function VenueImageField({ label, value, onChange, kind, context, disabled }) {
  const fileRef = useRef(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(null);

  const upload = async (file) => {
    if (!file) return;
    setBusy('upload');
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      onChange(file_url);
    } catch (err) { toast.error(err.message); }
    setBusy(null);
  };

  const generate = async (fromForm) => {
    const shape = kind === 'loading' ? 'wide 16:9 loading screen' : 'square cover art';
    const base = fromForm ? context : prompt.trim();
    if (!base) { toast.error(fromForm ? 'Fill in the venue details first' : 'Describe the image first'); return; }
    setBusy(fromForm ? 'auto' : 'ai');
    try {
      const { url } = await base44.integrations.Core.GenerateImage({
        prompt: `${shape} for a 3D live music venue. ${base}. Atmospheric, vivid stage lighting, no text or lettering.`,
      });
      onChange(url);
    } catch (err) { toast.error(err.message); }
    setBusy(null);
  };

  const off = disabled || !!busy;
  return (
    <div className="space-y-1.5 rounded-lg border border-border p-2.5">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
      {value && (
        <div className="relative">
          <img src={value} alt={label} className={`w-full rounded-md object-cover ${kind === 'loading' ? 'aspect-video' : 'aspect-square max-h-40'}`} />
          <button type="button" onClick={() => onChange('')} className="absolute top-1 right-1 bg-background/80 rounded-full p-1"><X className="w-3 h-3" /></button>
        </div>
      )}
      <div className="flex gap-1.5">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https:// image link" className="h-8 text-xs rounded-md" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button type="button" size="sm" variant="outline" disabled={off} onClick={() => fileRef.current?.click()} className="gap-1">
          {busy === 'upload' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload
        </Button>
      </div>
      <div className="flex gap-1.5">
        <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the image to generate" className="h-8 text-xs rounded-md" />
        <Button type="button" size="sm" variant="outline" disabled={off} onClick={() => generate(false)} className="gap-1">
          {busy === 'ai' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Generate
        </Button>
      </div>
      <Button type="button" size="sm" variant="ghost" disabled={off} onClick={() => generate(true)} className="w-full gap-1 text-xs">
        {busy === 'auto' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Generate from my venue details
      </Button>
    </div>
  );
}