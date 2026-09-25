import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

/** Lists the creator's own Foundry patches. */
export default function FoundryPatchPicker({ value, onPick }) {
  const [plugins, setPlugins] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      setPlugins(await base44.entities.FoundryPlugin.filter({ user_id: me.id }, '-updated_date', 100));
    })();
  }, []);

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">Foundry patch</span>
      <select value={value || ''} disabled={!plugins}
        onChange={(e) => onPick(plugins.find((p) => p.id === e.target.value) || null)}
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground">
        <option value="">{!plugins ? 'Loading patches…' : plugins.length ? 'Choose a patch' : 'No patches yet — build one in BASE Foundry'}</option>
        {(plugins || []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
    </label>
  );
}