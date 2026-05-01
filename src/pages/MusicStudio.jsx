import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import QuickGenerateTab from '@/components/music/QuickGenerateTab';
import AdvancedGenerateTab from '@/components/music/AdvancedGenerateTab';

const TABS = [
  { id: 'quick',    label: '⚡ Quick Generate', icon: Zap,              desc: 'AI picks everything from a simple prompt' },
  { id: 'advanced', label: '🎛️ Advanced',        icon: SlidersHorizontal, desc: 'Full control over every parameter' },
];

export default function MusicStudio() {
  const [activeTab, setActiveTab] = useState('quick');

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <div className="flex-1" />
        <Badge variant="outline" className="text-xs">⚡ Phase 4</Badge>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-10 px-6 bg-gradient-to-br from-blue-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-2 tracking-tight">🎵 Music Studio</h1>
          <p className="text-white/60 text-lg">AI tracks via Loudly, Nuro, Sonic, Tempolor or Producer.</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="sticky top-14 z-30 bg-background/90 backdrop-blur border-b border-border/50">
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
        {activeTab === 'quick' ? <QuickGenerateTab /> : <AdvancedGenerateTab />}
      </div>
    </div>
  );
}