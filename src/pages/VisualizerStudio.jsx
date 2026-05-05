import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Film, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import StudioPageHeader from '@/components/studio/StudioPageHeader';
import AssetPicker from '@/components/studio/AssetPicker';
import StudioAudioPlayer from '@/components/audio/StudioAudioPlayer';
import ProvenancePanel from '@/components/studio/ProvenancePanel';
import AddToProjectButton from '@/components/studio/AddToProjectButton';

const STYLES = [
  { id: 'spectrum',  label: 'Spectrum',  emoji: '📊', desc: 'Animated frequency bars' },
  { id: 'particles', label: 'Particles', emoji: '✨', desc: 'Flowing particle field' },
  { id: 'waveform',  label: 'Waveform',  emoji: '〰️', desc: 'Pure waveform pulse' },
  { id: 'liquid',    label: 'Liquid',    emoji: '💧', desc: 'Reactive liquid metal' },
  { id: 'cinematic', label: 'Cinematic', emoji: '🎬', desc: 'AI-generated film loop' },
  { id: 'retro',     label: 'Retro',     emoji: '📺', desc: 'VHS / 80s glitch' },
];

export default function VisualizerStudio() {
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get('assetId');

  const [selected, setSelected] = useState(preselected ? [preselected] : []);
  const [style, setStyle] = useState('spectrum');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (selected.length === 0) { toast.error('Pick a track first'); return; }
    setRunning(true);
    try {
      const r = await base44.functions.invoke('generateVisualizer', { assetId: selected[0], style });
      setResult(r.data?.asset);
      toast.success('Visualizer generated!', { icon: '🎬' });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Visualizer failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Film} accent="purple"
        title="AI Visualizer Studio"
        subtitle="Generate animated music videos and visualizers from any track."
        badge="Phase 3" />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black">1. Track</h3>
            <AssetPicker assetType="track" selected={selected} onChange={setSelected} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black">2. Visualizer Style</h3>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${style === s.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-border bg-muted/30 hover:border-purple-500/40'}`}>
                  <div className="text-lg mb-0.5">{s.emoji}</div>
                  <p className="text-xs font-bold">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={generate} disabled={running || selected.length === 0}
            className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 gap-2 font-bold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? 'Rendering…' : 'Generate Visualizer'}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!result && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <Film className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Pick a track and a visualizer style.</p>
            </div>
          )}

          {result && (
            <>
              <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold truncate">{result.title}</p>
                  <AddToProjectButton asset={result} tool="visualizer_studio" toolRoute="/visualizer-studio" />
                </div>
                <StudioAudioPlayer src={result.file_url} title={result.title} compact />
                <p className="text-xs text-muted-foreground">
                  ▶ Render preview will be embedded here once provider response is wired.
                </p>
              </div>
              <ProvenancePanel asset={result} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}