import { useState } from 'react';
import { Video, Music, Type, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const KINDS = [
  { id: 'video', label: 'Video URL', icon: Video, placeholder: 'https://…mp4' },
  { id: 'audio', label: 'Audio URL', icon: Music, placeholder: 'https://…mp3' },
  { id: 'title', label: 'Title Text', icon: Type, placeholder: 'Your on-screen text' },
];

/** Adds a clip to the live Studio edit — video/audio by URL, or a text title. */
export default function AddClipBar({ onAdd, disabled }) {
  const [kind, setKind] = useState('video');
  const [value, setValue] = useState('');
  const active = KINDS.find(k => k.id === kind);

  const submit = () => {
    if (!value.trim()) return;
    onAdd(kind, value.trim());
    setValue('');
  };

  return (
    <div className="p-4 rounded-xl bg-card border border-border space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase">Add to timeline</p>
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