import { Switch } from '@/components/ui/switch';
import { NODE_DEFS } from '@/lib/foundry/nodeTypes';

/** One Foundry node: which Audiotool device it drives, and whether it's bypassed. */
export default function NodeLinkRow({ node, link, devices, bypassed, selected, onSelect, onLink, onBypass }) {
  const def = NODE_DEFS[node.type];
  return (
    <div onClick={onSelect}
      className={`rounded-xl border p-3 space-y-2 cursor-pointer ${selected ? 'border-[#FF9A4D]/60 bg-[#FF9A4D]/5' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold truncate">{def?.label || node.type}</span>
        {link && (
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground" onClick={(e) => e.stopPropagation()}>
            Bypass <Switch checked={bypassed} onCheckedChange={onBypass} />
          </label>
        )}
      </div>
      <label className="block space-y-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-[11px] font-medium text-muted-foreground">Audiotool device</span>
        <select value={link?.device_id || ''} onChange={(e) => onLink(e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs text-foreground">
          <option value="">Not linked</option>
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
        </select>
      </label>
    </div>
  );
}