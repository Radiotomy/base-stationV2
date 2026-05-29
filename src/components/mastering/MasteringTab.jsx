import { useState } from 'react';
import { Sparkles, Wand2, Layers, Music } from 'lucide-react';
import AIMasteringPanel from './AIMasteringPanel';
import AudioEditorPanel from './AudioEditorPanel';
import MultitrackMixerPanel from './MultitrackMixerPanel';
import RemixStudioPanel from './RemixStudioPanel';

const SUB_TABS = [
  { key: 'ai_mastering', label: 'AI Mastering',  icon: Sparkles, desc: 'Character sliders + EQ + LUFS' },
  { key: 'editor',       label: 'Audio Editor',  icon: Wand2,    desc: 'Clean, de-noise, trim & polish' },
  { key: 'multitrack',   label: 'Multitrack Mixer', icon: Layers, desc: 'Mix stems & individual tracks' },
  { key: 'remix',        label: 'Audio Remix',   icon: Music,    desc: 'Stems, VOX, remaster' },
];

export default function MasteringTab() {
  const [activeSub, setActiveSub] = useState('ai_mastering');

  return (
    <div className="space-y-5">
      {/* Sub-tab selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {SUB_TABS.map(({ key, label, icon: Icon, desc }) => (
          <button key={key} onClick={() => setActiveSub(key)}
            className={`p-3 rounded-xl border text-left transition-all ${activeSub === key
              ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10'
              : 'border-border bg-card hover:border-amber-500/40'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${activeSub === key ? 'text-amber-400' : 'text-muted-foreground'}`} />
              <p className={`text-sm font-bold ${activeSub === key ? 'text-foreground' : 'text-foreground/80'}`}>{label}</p>
            </div>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div>
        {activeSub === 'ai_mastering' && <AIMasteringPanel />}
        {activeSub === 'editor' && <AudioEditorPanel />}
        {activeSub === 'multitrack' && <MultitrackMixerPanel />}
        {activeSub === 'remix' && <RemixStudioPanel />}
      </div>
    </div>
  );
}