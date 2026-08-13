import { useState } from 'react';
import { Type, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * Optional on-screen text for a single scene (title card, lyric line, credit).
 * Rendered by Shotstack as a bottom-centred caption over the clip.
 */
export default function SceneTextOverlayInput({ value, onChange }) {
  const [open, setOpen] = useState(!!value);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-indigo-300 transition-colors"
      >
        <Type className="w-3 h-3" /> Add on-screen text
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Type className="w-3 h-3 text-indigo-400 flex-shrink-0" />
      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="On-screen text (lyric, title, credit)"
        className="flex-1 text-xs h-8"
      />
      <button
        type="button"
        onClick={() => { onChange(''); setOpen(false); }}
        className="text-muted-foreground hover:text-rose-400"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}