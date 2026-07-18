import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getLyricsSpec } from '@/config/modelLyricsSpec';
import InfoTip from '@/components/common/InfoTip';

// Vocal-capable music generation models a lyric can target.
// Each model carries a hover description explaining who makes it and what it's best at.
const OPTIONS = [
  {
    group: 'Sonic (Suno)',
    provider: 'sonic',
    models: [
      { value: 'sonic-v5-5', desc: 'Suno v5.5 — the flagship Suno engine. Best overall quality, richest vocals, returns 2 track variations per generation.' },
      { value: 'sonic-v5', desc: 'Suno v5 — latest-generation Suno model with improved coherence and vocal realism.' },
      { value: 'sonic-v4-5-plus', desc: 'Suno v4.5 Plus — premium tier of v4.5. Fast, reliable, strong vocal fidelity. Great default choice.' },
      { value: 'sonic-v4-5', desc: 'Suno v4.5 — enhanced vocal quality over legacy versions at a balanced speed.' },
    ],
  },
  {
    group: 'Tempolor',
    provider: 'tempcolor',
    models: [
      { value: 'TemPolor v4.6', desc: 'TemPolor v4.6 — TemPolor\'s flagship song model. Best all-round, up to 5-minute tracks, 30+ languages.' },
      { value: 'TemPolor v3.5', desc: 'TemPolor v3.5 — natural, lifelike vocals up to 4.5 minutes. Supports English, Chinese, Japanese & Cantonese only.' },
      { value: 'Lyria 3 Pro', desc: 'Lyria 3 Pro — by Google DeepMind. Polished, studio-grade vocals up to 3 minutes, multilingual.' },
      { value: 'Mureka V9', desc: 'Mureka V9 — by Mureka (Kunlun Tech). Richest, most layered arrangements, up to 5.5 minutes, 10+ languages.' },
      { value: 'MiniMax 2.6', desc: 'MiniMax 2.6 — by MiniMax. Premium vocal quality and the longest tracks available (up to 6 minutes).' },
    ],
  },
  {
    group: 'ElevenLabs',
    provider: 'elevenlabs',
    models: [
      { value: 'music_v1', desc: 'Eleven Music v1 — by ElevenLabs. Flagship music model, vocals or instrumental, instant synchronous results, C2PA-signed.' },
      { value: 'music_v2', desc: 'Eleven Music v2 — by ElevenLabs. Latest version with highest-fidelity 48kHz output.' },
    ],
  },
];

/** Pick the music gen model these lyrics will target — value = "provider|model". */
export default function TargetModelSelect({ value, onChange }) {
  const [provider, model] = value.split('|');
  const max = getLyricsSpec(provider, model).maxLyricsChars;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
        Target Music Model
        <InfoTip text="Which AI music model will sing these lyrics? Each model has its own character limit — generation is auto-capped so your lyrics always fit. Hover a model for details." />
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-xl bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <TooltipProvider delayDuration={150}>
            {OPTIONS.map(({ group, provider: p, models }) => (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {models.map(m => (
                  <Tooltip key={m.value}>
                    <TooltipTrigger asChild>
                      <SelectItem value={`${p}|${m.value}`}>
                        {m.value} · {getLyricsSpec(p, m.value).maxLyricsChars.toLocaleString()} chars
                      </SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[260px] text-xs leading-relaxed">
                      {m.desc}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </SelectGroup>
            ))}
          </TooltipProvider>
        </SelectContent>
      </Select>
      <p className="text-[10px] text-muted-foreground">Lyric budget capped at {max.toLocaleString()} characters for this model.</p>
    </div>
  );
}