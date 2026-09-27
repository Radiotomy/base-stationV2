import { Switch } from '@/components/ui/switch';
import CopyLinkButton from './CopyLinkButton';
import OriginMarker from './OriginMarker';
import { deviceFamily, familyVars } from '@/lib/audiotool/familyColors';

export default function ExplorerDeviceRow({ device, disabled, onToggle, highlighted, onCopyLink, ai }) {
  const active = device.entity.fields.isActive;
  return (
    <div id={`nexus-${device.id}`} style={familyVars(deviceFamily(device.type))}
      className={`at-family-row flex items-center gap-3 py-2.5 pr-[11px] pl-[15px] ${highlighted ? 'ring-1 ring-accent' : ''}`}>
      <div className="flex flex-1 flex-col gap-[3px] min-w-0">
        <div className="text-[13px] font-[550] leading-[1.25] tracking-[.005em] text-[#f1ece5] truncate">{device.name}</div>
        <div className="flex items-center gap-2 text-[10px] leading-[1.3] text-[#8e857a]">
          <span className="truncate">{device.type}</span>
          <OriginMarker ai={ai} />
        </div>
      </div>
      <CopyLinkButton onClick={onCopyLink} />
      {active && (
        <label className="flex items-center gap-2 flex-none text-[10px] leading-[1.3] text-[#b8afa4]">
          {active.value ? 'On' : 'Bypassed'}
          <Switch className="at-toggle" checked={active.value} disabled={disabled} onCheckedChange={(v) => onToggle(active, v)} />
        </label>
      )}
    </div>
  );
}