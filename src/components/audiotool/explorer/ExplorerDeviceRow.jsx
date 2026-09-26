import { Switch } from '@/components/ui/switch';
import CopyLinkButton from './CopyLinkButton';

export default function ExplorerDeviceRow({ device, disabled, onToggle, highlighted, onCopyLink }) {
  const active = device.entity.fields.isActive;
  return (
    <div id={`nexus-${device.id}`} className={`flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 ${highlighted ? 'ring-1 ring-accent' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{device.name}</div>
        <div className="text-[11px] text-muted-foreground">{device.type}</div>
      </div>
      <CopyLinkButton onClick={onCopyLink} />
      {active && (
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {active.value ? 'On' : 'Bypassed'}
          <Switch checked={active.value} disabled={disabled} onCheckedChange={(v) => onToggle(active, v)} />
        </label>
      )}
    </div>
  );
}