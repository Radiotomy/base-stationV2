import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createProject, studioUrl } from '@/lib/audiotool/audiotoolProjects';
import { requestProjectCover } from '@/lib/audiotool/projectCovers';
import { DEMO } from '@/lib/audiotool/demoSong';

/** Shown before a project is open in demo mode: creates a fresh project for the hackathon song. */
export default function DemoProjectStarter({ at, onOpen }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const title = `${DEMO.title} (Hackathon demo)`;
      const p = await createProject(at, title);
      const url = studioUrl(p);
      sessionStorage.setItem('demoAutoBuild', url);
      onOpen(url);
      requestProjectCover({ project_url: url, title, source: 'blank_default' });
    } catch (e) {
      setError(e.message || 'Could not create the project');
      setBusy(false);
    }
  };

  return (
    <section className="rack-module mb-5 space-y-3">
      <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Generate the Hackathon Song</h3>
      <p className="text-sm text-muted-foreground">
        Create a new empty Audiotool project and write "{DEMO.title}" into it automatically, or pick an existing project below.
      </p>
      <Button onClick={start} disabled={busy} className="merc-button gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy ? 'Creating project…' : 'Create project & generate song'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}