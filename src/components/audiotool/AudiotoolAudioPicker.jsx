import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { listProjectSamples, listMyLibrary, sampleForEntity, downloadAsFile } from '@/lib/audiotool/audiotoolSamples';

const fmt = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round((s || 0) % 60)).padStart(2, '0')}`;

export default function AudiotoolAudioPicker({ at, nexus, onPicked }) {
  const [source, setSource] = useState('project');
  const [items, setItems] = useState([]);
  const [newName, setNewName] = useState('');
  const [state, setState] = useState({ loading: false, busy: '', error: '' });

  const load = useCallback(async () => {
    setState({ loading: true, busy: '', error: '' });
    try {
      setItems(source === 'project' ? await listProjectSamples(at, nexus) : await listMyLibrary(at));
      setState({ loading: false, busy: '', error: '' });
    } catch (e) {
      setItems([]);
      setState({ loading: false, busy: '', error: e.message });
    }
  }, [at, nexus, source]);

  const pick = useCallback(async (meta) => {
    setState((s) => ({ ...s, busy: meta.name, error: '' }));
    try {
      onPicked(await downloadAsFile(at, meta), meta.displayName || '');
      setState((s) => ({ ...s, busy: '' }));
    } catch (e) {
      setState((s) => ({ ...s, busy: '', error: e.message }));
    }
  }, [at, onPicked]);

  useEffect(() => { load(); }, [load]);

  // Auto-detect: a bounce dropped onto the timeline is picked up the moment it syncs.
  useEffect(() => {
    const sub = nexus.events.onCreate('sample', async (entity) => {
      const meta = await sampleForEntity(at, entity).catch(() => null);
      if (!meta) return;
      setNewName(meta.name);
      setItems((list) => [meta, ...list.filter((m) => m.name !== meta.name)]);
      toast.success(`New audio in your project: ${meta.displayName}`);
      pick(meta);
    });
    return () => (typeof sub === 'function' ? sub() : sub?.terminate?.());
  }, [at, nexus, pick]);

  return (
    <div className="rounded-xl bg-secondary/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Import from Audiotool:</span>
        {[['project', 'This project'], ['library', 'My library']].map(([k, label]) => (
          <Button key={k} size="sm" variant={source === k ? 'secondary' : 'ghost'} onClick={() => setSource(k)}>{label}</Button>
        ))}
        {state.loading && <Loader2 className="w-4 h-4 animate-spin" />}
      </div>
      {!state.loading && !items.length && !state.error && (
        <p className="text-xs text-muted-foreground">
          {source === 'project' ? 'No audio in this project yet — drop your bounce onto the timeline and it appears here automatically.' : 'No uploads in your Audiotool library.'}
        </p>
      )}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {items.map((m) => (
          <div key={m.name} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 bg-background/40">
            <span className="text-sm truncate flex items-center gap-1">
              {m.name === newName && <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
              {m.displayName || m.name} <span className="text-xs text-muted-foreground">· {fmt(m.durationSeconds)}</span>
            </span>
            <Button size="sm" variant="outline" disabled={!!state.busy} onClick={() => pick(m)}>
              {state.busy === m.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Use
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}