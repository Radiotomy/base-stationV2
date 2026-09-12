import { useState } from 'react';
import { Sparkles, Waves, Feather, Sunrise, Lightbulb } from 'lucide-react';
import HarmonixGenerateTab from '@/components/music/HarmonixGenerateTab';
import SirenSongGenerateTab from '@/components/music/SirenSongGenerateTab';
import SkyeGenerateTab from '@/components/music/SkyeGenerateTab';
import AuroraGenerateTab from '@/components/music/AuroraGenerateTab';
import InspireGenerateTab from '@/components/music/InspireGenerateTab';

// The four in-house BASE Engines live behind one primary tab. Presented as
// engine cards rather than a long tab strip: each engine is a different model
// with its own strengths, and the choice needs its own moment.
const ENGINES = [
  {
    id: 'harmonix', emoji: '🧬', name: 'BASE CODA', icon: Sparkles,
    tagline: 'Tag-driven generation',
    desc: 'Micro, Pro & Vault tiers — fast tag-based sketches through to full vault renders.',
    accent: 'border-fuchsia-500 bg-fuchsia-500/10',
  },
  {
    id: 'sirensong', emoji: '🌊', name: 'BASE Siren Song', icon: Waves,
    tagline: 'Tag + lyric conditioned',
    desc: 'Tag and lyric conditioned generation up to 6 minutes.',
    accent: 'border-cyan-500 bg-cyan-500/10',
  },
  {
    id: 'skye', emoji: '🪶', name: 'BASE Skye', icon: Feather,
    tagline: 'Prose style steering',
    desc: 'Seed-reproducible long-form renders, 95s–210s, with reference-audio style cloning.',
    accent: 'border-sky-500 bg-sky-500/10',
  },
  {
    id: 'aurora', emoji: '🌅', name: 'BASE Aurora', icon: Sunrise,
    tagline: 'Complete songs, lossless',
    desc: 'Structured-caption steering, songs up to 5 minutes, native 32kHz stereo WAV.',
    accent: 'border-amber-500 bg-amber-500/10',
  },
  {
    id: 'inspire', emoji: '💡', name: 'BASE Inspire', icon: Lightbulb,
    tagline: 'Instrumental, 48kHz',
    desc: 'Native 48kHz stereo instrumentals up to 5 minutes — and the only engine that continues your own audio.',
    accent: 'border-teal-500 bg-teal-500/10',
  },
];

export default function BaseEnginesTab() {
  const [engine, setEngine] = useState('harmonix');
  const active = ENGINES.find(e => e.id === engine);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black text-foreground uppercase mb-1">Choose a BASE Engine</p>
        <p className="text-xs text-muted-foreground mb-3">
          In-house developed forks, self-hosted on our own infrastructure.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {ENGINES.map(e => (
            <button key={e.id} onClick={() => setEngine(e.id)}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all ${engine === e.id ? e.accent : 'border-border bg-card hover:border-border/80'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{e.emoji}</span>
                <p className="text-sm font-black text-foreground">{e.name}</p>
              </div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{e.tagline}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{e.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-border/60">
        <div className="flex items-center gap-2 mb-4">
          {active && <active.icon className="w-4 h-4 text-muted-foreground" />}
          <p className="text-sm font-black text-foreground">{active?.name}</p>
        </div>
        {engine === 'harmonix' && <HarmonixGenerateTab />}
        {engine === 'sirensong' && <SirenSongGenerateTab />}
        {engine === 'skye' && <SkyeGenerateTab />}
        {engine === 'aurora' && <AuroraGenerateTab />}
        {engine === 'inspire' && <InspireGenerateTab />}
      </div>
    </div>
  );
}