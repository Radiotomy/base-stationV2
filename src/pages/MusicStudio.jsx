import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Zap, SlidersHorizontal, RotateCcw, AudioLines, Sparkles, Waves, Feather } from 'lucide-react';
import QuickGenerateTab from '@/components/music/QuickGenerateTab';
import AdvancedGenerateTab from '@/components/music/AdvancedGenerateTab';
import MySoundTab from '@/components/music/mysound/MySoundTab';
import HarmonixGenerateTab from '@/components/music/HarmonixGenerateTab';
import SirenSongGenerateTab from '@/components/music/SirenSongGenerateTab';
import SkyeGenerateTab from '@/components/music/SkyeGenerateTab';
import SonicToolsTab from '@/components/music/SonicToolsTab';
import { Wrench } from 'lucide-react';

const TABS = [
  { id: 'quick',    label: '⚡ Quick Generate', icon: Zap,              desc: 'AI picks everything from a simple prompt' },
  { id: 'advanced', label: '🎛️ Advanced',        icon: SlidersHorizontal, desc: 'Full control over every parameter' },
  { id: 'mysound',  label: '🎧 Eleven Music',     icon: AudioLines,        desc: 'Eleven Music base model + My Sound — train on your own tracks & generate in your signature style' },
  { id: 'harmonix', label: '🧬 BASE-Harmonix',    icon: Sparkles,          desc: 'Our open-source model studio — Micro, Pro & Vault tiers' },
  { id: 'sirensong', label: '🌊 Siren Song',       icon: Waves,             desc: 'Self-hosted HeartMuLa 3B — tag & lyric conditioned generation on our Hugging Face engine' },
  { id: 'skye',     label: '🪶 Skye',             icon: Feather,           desc: 'Our DiffRhythm 2 fork — prose style steering, seed-reproducible, long-form output from 95s to 210s' },
  { id: 'tools',    label: '🛠️ Sonic Tools',      icon: Wrench,            desc: 'Remaster, replace a section, add vocals or an instrumental, or stitch an extension — on any library track' },
];

export default function MusicStudio() {
  const [activeTab, setActiveTab] = useState('quick');
  const location = useLocation();
  const prefill = (() => {
    const sp = new URLSearchParams(location.search);
    return {
      prompt: sp.get('prompt') || '',
      genre:  sp.get('genre')  || '',
      provider: sp.get('provider') || '',
      tab: sp.get('tab') || '',
      lyricsAssetId: sp.get('lyrics') || '',
      topic: sp.get('topic') || '',
    };
  })();
  const hasPrefill = !!(prefill.prompt || prefill.genre);

  useEffect(() => {
    if (prefill.tab === 'advanced' || prefill.lyricsAssetId) setActiveTab('advanced');
    else if (prefill.provider || hasPrefill) setActiveTab('quick');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden pt-10 pb-10 px-6 bg-gradient-to-br from-blue-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-2 tracking-tight">🎵 Music Studio</h1>
          <p className="text-white/60 text-lg">Generate studio-quality tracks from a single prompt.</p>
          {hasPrefill && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
              <RotateCcw className="w-3 h-3" /> Re-generating from history — settings pre-filled
            </div>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="sticky top-16 z-30 bg-background/90 backdrop-blur border-b border-border/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1 py-2">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-card border border-border text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground pb-2 px-1">
            {TABS.find(t => t.id === activeTab)?.desc}
          </p>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        {activeTab === 'quick' && <QuickGenerateTab initialPrompt={prefill.prompt} initialGenre={prefill.genre} initialProvider={prefill.provider} />}
        {activeTab === 'advanced' && <AdvancedGenerateTab initialLyricsAssetId={prefill.lyricsAssetId} initialGenre={prefill.genre} initialTopic={prefill.topic} />}
        {activeTab === 'mysound' && <MySoundTab />}
        {activeTab === 'harmonix' && <HarmonixGenerateTab />}
        {activeTab === 'sirensong' && <SirenSongGenerateTab />}
        {activeTab === 'skye' && <SkyeGenerateTab />}
        {activeTab === 'tools' && <SonicToolsTab />}
      </div>
    </div>
  );
}