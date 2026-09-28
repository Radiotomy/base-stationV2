import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';

/** Searchable Kits voice list (your voices first, then the royalty-free library). */
export default function KitsVoicePicker({ value, onChange }) {
  const [voices, setVoices] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    base44.functions.invoke('kitsVoices', { action: 'list' }).then(({ data }) => {
      const all = [...(data.mine || []).filter((v) => v.is_usable !== false), ...(data.library || []).filter((v) => v.is_usable)];
      setVoices(all);
      if (!value && all[0]) onChange(all[0]);
    });
  }, []);

  const shown = useMemo(() => {
    const s = q.toLowerCase();
    return (voices || []).filter((v) => !s || v.title.toLowerCase().includes(s) || (v.tags || []).some((t) => t.toLowerCase().includes(s))).slice(0, 40);
  }, [voices, q]);

  if (!voices) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  const current = voices.find((v) => v.model_id === value?.model_id);

  return (
    <div className="space-y-2">
      <Input placeholder="Search voices (e.g. female, rock, choir)…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9" />
      <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
        {shown.map((v) => (
          <button key={v.id} type="button" onClick={() => onChange(v)}
            className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left ${value?.model_id === v.model_id ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/40'}`}>
            {v.image_url && <img src={v.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{v.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{v.is_platform ? 'Kits library' : v.source === 'blend' ? 'Your blend' : 'Your voice'} · {(v.tags || []).slice(0, 3).join(', ')}</p>
            </div>
          </button>
        ))}
        {!shown.length && <p className="text-xs text-muted-foreground p-2">No voices match.</p>}
      </div>
      {current?.demo_url && <audio src={current.demo_url} controls className="w-full h-8" />}
    </div>
  );
}