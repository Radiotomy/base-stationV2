import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, ExternalLink, ShieldCheck, Clock } from 'lucide-react';
import { AUDIOTOOL_SCOPE } from '@/lib/audiotool/nexusClient';
import { listMyProjects } from '@/lib/audiotool/audiotoolProjects';
import { tokenExpiry } from '@/lib/audiotool/audiotoolTokens';

const SCOPE_LABELS = {
  'user:read': 'Account name', 'project:read': 'Read projects', 'project:write': 'Edit projects',
  'sample:read': 'Download samples', 'sample:write': 'Upload samples', 'preset:read': 'Presets',
};

export default function AudiotoolAccountCard({ at, userName, logout }) {
  const [projects, setProjects] = useState(null);
  const [now, setNow] = useState(Date.now());
  const name = (userName || '').replace(/^users\//, '');

  useEffect(() => { listMyProjects(at).then((p) => setProjects(p.length), () => setProjects(null)); }, [at]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);

  const expiry = tokenExpiry(at);
  const mins = expiry ? Math.max(0, Math.round((expiry - now) / 60000)) : null;

  return (
    <section className="merc-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="merc-bubble w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-background">
          {name.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Audiotool account</p>
          <h2 className="text-lg font-bold truncate">{name}</h2>
          <p className="text-xs text-muted-foreground">
            {projects == null ? 'Loading projects…' : `${projects}${projects >= 30 ? '+' : ''} project${projects === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://beta.audiotool.com/studio" target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /> Open Audiotool</a>
          </Button>
          <Button variant="outline" size="sm" onClick={logout}><LogOut className="w-4 h-4" /> Disconnect</Button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" />
        {mins == null ? 'Signed in — your session renews automatically.' : `Session renews automatically (current key valid ~${mins} min).`}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Access you granted</p>
        <div className="flex flex-wrap gap-1.5">
          {AUDIOTOOL_SCOPE.split(' ').map((s) => <Badge key={s} variant="outline" className="text-[11px]">{SCOPE_LABELS[s] || s}</Badge>)}
        </div>
      </div>
    </section>
  );
}