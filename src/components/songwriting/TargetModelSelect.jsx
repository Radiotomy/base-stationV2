import { ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { getLyricsSpec } from '@/config/modelLyricsSpec';
import InfoTip from '@/components/common/InfoTip';

// Vocal-capable music models grouped by PUBLIC model family.
// Tempolor is the API provider behind TemPolor, Lyria, Mureka and MiniMax,
// but publicly each is its own model — so they're listed as separate families.
const FAMILIES = [
  {
    name: 'Sonic', maker: 'Sonic AI', provider: 'sonic',
    versions: [
      { value: 'sonic-v6', label: 'v6', desc: 'Flagship — newest generation, richest vocals, 2 variations per run.' },
      { value: 'sonic-v6-wild', label: 'v6 Wild', desc: 'More adventurous arrangements and phrasing on the same lyric.' },
      { value: 'sonic-v6-mini', label: 'v6 Mini', desc: 'Lighter, faster variant — ideal for quick lyric drafts.' },
      { value: 'sonic-v5-5', label: 'v5.5', desc: 'Deprecated — still accepted, now rendered by v6.', deprecated: true },
      { value: 'sonic-v5', label: 'v5', desc: 'Deprecated — still accepted, now rendered by v6.', deprecated: true },
      { value: 'sonic-v4-5-plus', label: 'v4.5 Plus', desc: 'Deprecated — still accepted, now rendered by v6.', deprecated: true },
      { value: 'sonic-v4-5', label: 'v4.5', desc: 'Deprecated — still accepted, now rendered by v6.', deprecated: true },
    ],
  },
  {
    name: 'TemPolor', maker: 'TemPolor', provider: 'tempcolor',
    versions: [
      { value: 'TemPolor v4.6', label: 'v4.6', desc: 'Flagship song model — best all-round, up to 5-minute tracks, 30+ languages.' },
      { value: 'TemPolor v3.5', label: 'v3.5', desc: 'Natural, lifelike vocals up to 4.5 minutes. English, Chinese, Japanese & Cantonese only.' },
    ],
  },
  {
    name: 'Lyria', maker: 'Google DeepMind', provider: 'tempcolor',
    versions: [
      { value: 'Lyria 3 Pro', label: '3 Pro', desc: 'Polished, studio-grade vocals up to 3 minutes, multilingual.' },
    ],
  },
  {
    name: 'Mureka', maker: 'Kunlun Tech', provider: 'tempcolor',
    versions: [
      { value: 'Mureka V9', label: 'V9', desc: 'Richest, most layered arrangements — up to 5.5 minutes, 10+ languages.' },
    ],
  },
  {
    name: 'MiniMax', maker: 'MiniMax', provider: 'tempcolor',
    versions: [
      { value: 'MiniMax 2.6', label: '2.6', desc: 'Premium vocal quality and the longest tracks available (up to 6 minutes).' },
    ],
  },
  {
    name: 'Eleven Music', maker: 'ElevenLabs', provider: 'elevenlabs',
    versions: [
      { value: 'music_v1', label: 'v1', desc: 'Flagship — vocals or instrumental, instant synchronous results, C2PA-signed.' },
      { value: 'music_v2', label: 'v2', desc: 'Latest — highest-fidelity 48kHz output.' },
    ],
  },
];

/** Pick the music gen model these lyrics will target — value = "provider|model". */
export default function TargetModelSelect({ value, onChange }) {
  const [provider, model] = value.split('|');
  const max = getLyricsSpec(provider, model).maxLyricsChars;
  const current = FAMILIES.find(f => f.provider === provider && f.versions.some(v => v.value === model));
  const currentVersion = current?.versions.find(v => v.value === model);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
        Target Music Model
        <InfoTip text="Which AI music model will sing these lyrics? Pick a model, then its version. Each has its own character limit — generation is auto-capped so your lyrics always fit." />
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between rounded-xl bg-background font-normal text-sm">
            <span>{current ? `${current.name} ${currentVersion.label}` : model} <span className="text-muted-foreground">· {max.toLocaleString()} chars</span></span>
            <ChevronDown className="w-4 h-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {FAMILIES.map(f => (
            <DropdownMenuSub key={f.name}>
              <DropdownMenuSubTrigger className="gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{f.name}{f === current && <Check className="inline w-3.5 h-3.5 ml-1.5 text-pink-400" />}</p>
                  <p className="text-[10px] text-muted-foreground">{f.maker}</p>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-72">
                {f.versions.map(v => (
                  <DropdownMenuItem key={v.value} onSelect={() => onChange(`${f.provider}|${v.value}`)}
                    className={`flex-col items-start gap-0.5 cursor-pointer ${v.deprecated ? 'opacity-60' : ''}`}>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      {f.name} {v.label}
                      {v.deprecated && <span className="text-[9px] font-semibold uppercase text-amber-400">Deprecated</span>}
                      {model === v.value && f.provider === provider && <Check className="w-3.5 h-3.5 text-pink-400" />}
                      <span className="text-[10px] font-normal text-muted-foreground">· {getLyricsSpec(f.provider, v.value).maxLyricsChars.toLocaleString()} chars</span>
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug">{v.desc}</p>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="text-[10px] text-muted-foreground">Lyric budget capped at {max.toLocaleString()} characters for this model. ✨ More models coming soon.</p>
    </div>
  );
}