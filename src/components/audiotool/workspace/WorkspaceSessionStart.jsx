import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AudiotoolProjectList from '@/components/audiotool/AudiotoolProjectList';
import { createProject, studioUrl } from '@/lib/audiotool/audiotoolProjects';

export default function WorkspaceSessionStart({ at, workspace, opening, error, onOpen }) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const startNew = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const p = await createProject(at, `${workspace.label} · ${new Date().toLocaleString()}`);
      onOpen(studioUrl(p));
    } catch (e) { setCreateError(e.message); }
    setCreating(false);
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-5">
      <section className="merc-card rounded-3xl p-6 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">Open existing</p>
        <AudiotoolProjectList at={at} activeUrl="" busy={opening} onOpen={onOpen} />
      </section>
      <section className="merc-card rounded-3xl p-6 flex flex-col gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">Start new</p>
        <h3 className="text-2xl font-black tracking-tight">A blank canvas</h3>
        <p className="text-sm text-muted-foreground flex-1">
          We'll create a fresh Audiotool project and open it here live. Everything you make syncs to it instantly.
        </p>
        <Button className="merc-button h-11 rounded-xl" disabled={creating || opening} onClick={startNew}>
          {creating || opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {creating ? 'Creating project…' : opening ? 'Opening session…' : 'Start fresh'}
        </Button>
        {(createError || error) && <p className="text-sm text-destructive">{createError || error}</p>}
      </section>
    </div>
  );
}