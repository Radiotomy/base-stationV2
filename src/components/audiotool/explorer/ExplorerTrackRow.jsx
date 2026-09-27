import { Switch } from '@/components/ui/switch';
import CopyLinkButton from './CopyLinkButton';
import OriginMarker from './OriginMarker';
import { trackFamily, familyVars } from '@/lib/audiotool/familyColors';

export default function ExplorerTrackRow({ track, disabled, onToggle, highlighted, onCopyLink, ai }) {
  const enabled = track.entity.fields.isEnabled;
  return (
    <div id={`nexus-${track.id}`} style={familyVars(trackFamily(track.kind))}
      className={`at-family-row py-2.5 pr-[11px] pl-[15px] space-y-1.5 ${highlighted ? 'ring-1 ring-accent' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-col gap-[3px] min-w-0">
          <span className="text-[13px] font-[550] leading-[1.25] text-[#f1ece5] truncate">{track.name}</span>
          <div className="flex items-center gap-2 text-[10px] leading-[1.3] text-[#8e857a]">
            <span>{track.kind} track</span>
            <OriginMarker ai={ai} />
          </div>
        </div>
        <CopyLinkButton onClick={onCopyLink} />
        {enabled && (
          <Switch className="at-toggle" checked={enabled.value} disabled={disabled} onCheckedChange={(v) => onToggle(enabled, v)}
            aria-label={enabled.value ? 'Disable track' : 'Enable track'} />
        )}
      </div>
      {track.regions.length === 0 ? (
        <p className="text-[11px] text-[#8e857a]">No regions</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {track.regions.map((r) => (
            <span key={r.id} className="text-[11px] rounded-md border border-[#30271f] bg-[#1b1712] px-1.5 py-0.5 text-[#a9a097]">
              {r.name} · bar {r.bar} · {r.bars} bar{r.bars > 1 ? 's' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}