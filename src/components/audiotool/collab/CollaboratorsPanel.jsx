import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Users, RefreshCw } from 'lucide-react';
import useProjectCollaborators from '@/hooks/useProjectCollaborators';
import { ROLE_TYPES } from '@/lib/audiotool/projectRoles';
import CollaboratorRow from '@/components/audiotool/collab/CollaboratorRow';

export default function CollaboratorsPanel({ at, projectName }) {
  const c = useProjectCollaborators(at, projectName);
  const [user, setUser] = useState('');
  const [roleType, setRoleType] = useState(3);
  if (!projectName) return null;

  const add = async () => { await c.add(user, roleType); setUser(''); };

  return (
    <section className="rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold flex items-center gap-2"><Users className="w-4 h-4" /> Collaborators</h3>
          <p className="text-sm text-muted-foreground">Invite Audiotool users to this project. Credited editors appear as contributors when it's published as a track.</p>
        </div>
        <Button size="icon" variant="ghost" onClick={c.reload} disabled={c.loading} aria-label="Refresh">
          <RefreshCw className={c.loading ? 'animate-spin' : ''} />
        </Button>
      </div>
      <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div className="space-y-1"><Label>Audiotool username</Label><Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="username" /></div>
        <div className="space-y-1">
          <Label>Role</Label>
          <select value={roleType} onChange={(e) => setRoleType(Number(e.target.value))} className="h-9 rounded-md border border-input bg-popover px-3 text-sm">
            {ROLE_TYPES.map(([v, l, d]) => <option key={v} value={v} title={d}>{l}</option>)}
          </select>
        </div>
        <Button className="merc-button" onClick={add} disabled={!user.trim() || c.busy === 'add'}>
          {c.busy === 'add' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
          Invite
        </Button>
      </div>
      {c.error && <p className="text-sm text-destructive">{c.error}</p>}
      {!c.loading && !c.error && !c.roles.length && <p className="text-sm text-muted-foreground">No collaborators yet — it's just you.</p>}
      <div className="space-y-2">
        {c.roles.map((r) => <CollaboratorRow key={r.name} role={r} busy={c.busy === r.name} onRole={c.setRole} onRemove={c.remove} />)}
      </div>
    </section>
  );
}