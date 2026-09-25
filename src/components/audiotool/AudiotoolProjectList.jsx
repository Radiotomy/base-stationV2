import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Music2, Check } from 'lucide-react';
import CreateProjectMenu from '@/components/audiotool/CreateProjectMenu';
import { Button } from '@/components/ui/button';
import { listMyProjects, createProject, studioUrl } from '@/lib/audiotool/audiotoolProjects';

const when = (ts) => (ts?.seconds ? new Date(Number(ts.seconds) * 1000).toLocaleDateString() : '');

export default function AudiotoolProjectList({ at, activeUrl, busy, onOpen }) {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setError('');
    setProjects(null);
    listMyProjects(at).then(setProjects).catch((e) => { setError(e.message); setProjects([]); });
  }, [at]);
  useEffect(load, [load]);

  const create = async (templateName) => {
    // Opened synchronously inside the click so the browser doesn't block it.
    const tab = window.open('about:blank', '_blank');
    setCreating(true);
    setError('');
    try {
      const label = templateName ? 'BASE Songstarter' : 'BASE Station session';
      const p = await createProject(at, `${label} ${new Date().toLocaleString()}`, templateName);
      const url = studioUrl(p);
      if (tab) tab.location.href = url;
      window.focus();
      setProjects((list) => [p, ...(list || [])]);
      onOpen(url);
    } catch (e) {
      tab?.close();
      setError(e.message);
    }
    setCreating(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">Your Audiotool projects</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={!projects}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
          <CreateProjectMenu creating={creating} disabled={busy} onCreate={create} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!projects ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet — create one to get started.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {projects.map((p) => {
            const url = studioUrl(p);
            const active = url === activeUrl;
            return (
              <button key={p.name} onClick={() => onOpen(url)} disabled={busy || active}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left border transition-colors disabled:cursor-default ${active ? 'border-accent bg-accent/10' : 'border-border bg-secondary/50 hover:bg-secondary'}`}>
                {p.coverUrl
                  ? <img src={p.coverUrl.replace('600x600', '60x60')} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  : <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Music2 className="w-4 h-4 text-muted-foreground" /></div>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.displayName || 'Untitled project'}</p>
                  <p className="text-xs text-muted-foreground">{[p.bpm ? `${Math.round(p.bpm)} BPM` : '', when(p.updateTime)].filter(Boolean).join(' · ')}</p>
                </div>
                {active && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}