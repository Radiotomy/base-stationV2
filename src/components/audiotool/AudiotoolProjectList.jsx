import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Music2, Check, Trash2 } from 'lucide-react';
import CreateProjectMenu from '@/components/audiotool/CreateProjectMenu';
import { Button } from '@/components/ui/button';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';
import { requestProjectCover, loadProjectCovers } from '@/lib/audiotool/projectCovers';
import { listMyProjects, createProject, deleteProject, studioUrl } from '@/lib/audiotool/audiotoolProjects';

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

  const [deleting, setDeleting] = useState('');
  const remove = async (p) => {
    if (!window.confirm(`Permanently delete "${p.displayName || 'Untitled project'}" from Audiotool? This cannot be undone.`)) return;
    setDeleting(p.name);
    setError('');
    try {
      await deleteProject(at, p.name);
      setProjects((list) => list.filter((x) => x.name !== p.name));
    } catch (e) {
      setError(e.message);
    }
    setDeleting('');
  };

  const [covers, setCovers] = useState({});
  const [pendingCover, setPendingCover] = useState('');
  useEffect(() => { loadProjectCovers().then(setCovers).catch(() => {}); }, []);

  const create = async (templateName, cover = { source: 'blank_default' }) => {
    // Opened synchronously inside the click so the browser doesn't block it.
    const tab = window.open('about:blank', '_blank');
    setCreating(true);
    setError('');
    try {
      const label = cover.label || (templateName ? 'BASE Songstarter' : 'BASE Station session');
      const displayName = `${label} ${new Date().toLocaleString()}`;
      const p = await createProject(at, displayName, templateName);
      const url = studioUrl(p);
      if (tab) tab.location.href = url;
      window.focus();
      setProjects((list) => [p, ...(list || [])]);
      onOpen(url);
      // Cover art is best-effort and never blocks the new project.
      setPendingCover(url);
      requestProjectCover({ project_url: url, title: displayName, ...cover }).then((img) => {
        if (img) setCovers((c) => ({ ...c, [url]: img }));
        setPendingCover('');
      });
    } catch (e) {
      tab?.close();
      setError(e.message);
    }
    setCreating(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold flex items-center gap-2">Your Audiotool projects <InfoTip text={TIPS.projects} size="sm" side="bottom" /></h3>
        <div className="flex items-center gap-2">
          <InfoTip text={TIPS.newProject} size="sm" side="bottom" />
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
              <div key={p.name} className="relative group">
              <button onClick={() => onOpen(url)} disabled={busy || active}
                className={`w-full pr-10 flex items-center gap-3 rounded-xl px-3 py-2 text-left border transition-colors disabled:cursor-default ${active ? 'border-accent bg-accent/10' : 'border-border bg-secondary/50 hover:bg-secondary'}`}>
                {pendingCover === url && !covers[url]
                  ? <div className="w-10 h-10 rounded-lg bg-muted animate-pulse flex-shrink-0" />
                  : covers[url]
                  ? <img src={covers[url]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  : p.coverUrl
                  ? <img src={p.coverUrl.replace('600x600', '60x60')} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  : <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Music2 className="w-4 h-4 text-muted-foreground" /></div>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.displayName || 'Untitled project'}</p>
                  <p className="text-xs text-muted-foreground">{[p.bpm ? `${Math.round(p.bpm)} BPM` : '', when(p.updateTime)].filter(Boolean).join(' · ')}</p>
                </div>
                {active && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
              </button>
              {!active && (
                <button onClick={() => remove(p)} disabled={busy || deleting === p.name} title="Delete project"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  {deleting === p.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}