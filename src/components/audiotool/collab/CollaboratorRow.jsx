import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { ROLE_TYPES } from '@/lib/audiotool/projectRoles';

export default function CollaboratorRow({ role, busy, onRole, onRemove }) {
  const handle = role.userName.replace(/^users\//, '');
  return (
    <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
      <a href={`https://www.audiotool.com/user/${handle}`} target="_blank" rel="noreferrer" className="flex-1 min-w-0 truncate text-sm font-medium hover:underline">
        @{handle}
      </a>
      <select
        value={role.roleType}
        disabled={busy}
        onChange={(e) => onRole(role, Number(e.target.value))}
        className="h-8 rounded-md border border-input bg-popover px-2 text-xs"
      >
        {ROLE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Button size="icon" variant="ghost" disabled={busy} onClick={() => onRemove(role)} aria-label="Remove collaborator">
        {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </div>
  );
}