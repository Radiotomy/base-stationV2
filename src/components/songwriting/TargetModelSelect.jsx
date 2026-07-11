import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLyricsSpec } from '@/config/modelLyricsSpec';
import InfoTip from '@/components/common/InfoTip';

// Vocal-capable music generation models a lyric can target
const OPTIONS = [
  { group: 'Sonic', provider: 'sonic', models: ['sonic-v5-5', 'sonic-v5', 'sonic-v4-5-plus', 'sonic-v4-5'] },
  { group: 'Tempolor', provider: 'tempcolor', models: ['TemPolor v4.6', 'TemPolor v3.5', 'Lyria 3 Pro', 'Mureka V9', 'MiniMax 2.6'] },
  { group: 'Producer', provider: 'producer', models: ['FUZZ-2.0'] },
];

/** Pick the music gen model these lyrics will target — value = "provider|model". */
export default function TargetModelSelect({ value, onChange }) {
  const [provider, model] = value.split('|');
  const max = getLyricsSpec(provider, model).maxLyricsChars;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
        Target Music Model
        <InfoTip text="Which AI music model will sing these lyrics? Each model has its own character limit — generation is auto-capped so your lyrics always fit." />
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-xl bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map(({ group, provider: p, models }) => (
            <SelectGroup key={group}>
              <SelectLabel>{group}</SelectLabel>
              {models.map(m => (
                <SelectItem key={m} value={`${p}|${m}`}>
                  {m} · {getLyricsSpec(p, m).maxLyricsChars.toLocaleString()} chars
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[10px] text-muted-foreground">Lyric budget capped at {max.toLocaleString()} characters for this model.</p>
    </div>
  );
}