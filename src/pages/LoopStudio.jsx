import { useState } from 'react';
import { Music2 } from 'lucide-react';
import LoopDiscoverTab from '@/components/loops/LoopDiscoverTab';
import MyLoopsTab from '@/components/loops/MyLoopsTab';
import CommunityLoopsTab from '@/components/loops/CommunityLoopsTab';
import GenerateLoopTab from '@/components/loops/GenerateLoopTab';

const TABS = [
  { key: 'generate', label: 'Generate (BASE SoundForge)' },
  { key: 'discover', label: 'Discover Free Loops' },
  { key: 'mine', label: 'My Loops' },
  { key: 'community', label: 'Community Library' },
];

export default function LoopStudio() {
  const [tab, setTab] = useState('discover');

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9A4D]/30 bg-[#FF9A4D]/10 px-4 py-1.5 text-sm text-[#FFC98A]">
            <Music2 className="w-4 h-4" /> Loops & Samples Studio
          </div>
          <h1 className="font-display text-3xl md:text-4xl">Loops & Samples</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Discover free, royalty-free loops, upload your own sounds — single files or whole batches —
            and build your personal sample library.
          </p>
        </div>

        <div className="flex justify-center gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${tab === t.key ? 'border-purple-500 bg-purple-500/10 text-foreground' : 'border-border text-muted-foreground hover:border-border/80'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'generate' && <GenerateLoopTab />}
        {tab === 'discover' && <LoopDiscoverTab />}
        {tab === 'mine' && <MyLoopsTab />}
        {tab === 'community' && <CommunityLoopsTab />}
      </div>
    </div>
  );
}