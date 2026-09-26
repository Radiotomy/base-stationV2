import { Label } from '@/components/ui/label';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';

export default function GenrePicker({ value, genres, suggested, onChange }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs flex items-center gap-1.5">Genre <InfoTip text={TIPS.genre} /></Label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-input bg-popover px-3 text-sm">
        <option value="">{suggested ? `From project tags (${suggested})` : genres.length ? 'Choose a genre…' : 'Loading genres…'}</option>
        {genres.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <p className="text-[11px] text-muted-foreground">Used for Audius and to place the track on the right BASE Station chart.</p>
    </div>
  );
}