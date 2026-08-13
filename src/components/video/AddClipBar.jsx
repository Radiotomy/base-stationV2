import { useState } from 'react';
import { Link2, Type, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { kindFromUrl } from '@/lib/video/assetKind';

const KINDS = [
  { id: 'url', label: 'Media URL', icon: Link2, placeholder: 'https://…mp4 / .mp3 / .jpg' },
  { id: 'title', label: 'Title Text', icon: Type, placeholder: 'Your on-screen text' },
];

/** Adds a clip by external URL (video/audio/image, auto-detected) or as a text title. */
export default function AddClipBar({ onAdd, disabled }) {
  const [kind, setKind] = useState('url');
  const [value, setValue] = useState('');
  const active = KINDS.find(k => k.id === kind);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(kind === 'title' ? 'title' : kindFromUrl(v), v);
    setValue('');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {KINDS.map(k => (
          <button key={k.id} type="button" onClick={() => setKind(k.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all ${kind === k.id ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            <k.icon className="w-3.5 h-3.5" /> {k.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={value} onChange={e => setValue(e.target.value)} placeholder={active.placeholder}
          onKeyDown={e => e.key === 'Enter' && submit()} className="rounded-xl" />
        <Button onClick={submit} disabled={disabled || !value.trim()} className="gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
    </div>
  );
}