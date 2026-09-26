import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { listCollaborators, addCollaborator, changeCollaboratorRole, removeCollaborator } from '@/lib/audiotool/projectRoles';

const msg = (e) => e.cause?.message || e.message;

export default function useProjectCollaborators(at, projectName) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!at || !projectName) return;
    setLoading(true);
    setError('');
    try { setRoles(await listCollaborators(at, projectName)); } catch (e) { setError(msg(e)); }
    setLoading(false);
  }, [at, projectName]);

  useEffect(() => { load(); }, [load]);

  const run = async (key, fn, success) => {
    setBusy(key);
    try { await fn(); toast.success(success); await load(); } catch (e) { toast.error(msg(e)); }
    setBusy('');
  };

  return {
    roles, loading, busy, error, reload: load,
    add: (user, roleType) => run('add', () => addCollaborator(at, projectName, user, roleType), 'Collaborator added.'),
    setRole: (role, roleType) => run(role.name, () => changeCollaboratorRole(at, role, roleType), 'Role updated.'),
    remove: (role) => run(role.name, () => removeCollaborator(at, role), 'Collaborator removed.'),
  };
}