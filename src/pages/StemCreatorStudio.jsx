import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Layers, Loader2, Wand2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import StudioPageHeader from '@/components/studio/StudioPageHeader';
import AssetPicker from '@/components/studio/AssetPicker';
import StudioAudioPlayer from '@/components/audio/StudioAudioPlayer';
import ProvenancePanel from '@/components/studio/ProvenancePanel';
import AddToProjectButton from '@/components/studio/AddToProjectButton';

const STEM_TYPES = [
  { id: 'vocals', label: 'Vocals', emoji: '🎤' },
  { id: 'drums', label: 'Drums', emoji: '🥁' },
  { id: 'bass', label: 'Bass', emoji: '🎸' },
  { id: 'other', label: 'Other (Instruments)', emoji: '🎹' },
];

export default function StemCreatorStudio() {
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get('assetId');

  const [selected, setSelected] = useState(preselected ? [preselected] : []);
  const [stemTypes, setStemTypes] = useState(['vocals', 'drums', 'bass', 'other']);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const toggleStem = (id) => {
    setStemTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const generate = async () => {
    if (selected.length === 0) { toast.error('Pick a track first'); return; }
    if (stemTypes.length === 0) { toast.error('Pick at least one stem'); return; }
    setRunning(true);
    setResult(null);
    try {
      const r = await base44.functions.invoke('generateStems', { assetId: selected[0], stemTypes });
      setResult(r.data);
      toast.success(`Separated ${r.data?.stems?.length || stemTypes.length} stems`, { icon: '🎛️' });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Stem separation failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Layers} accent="emerald"
        title="Stem Creator Studio"
        subtitle="Split any track into individual stems — vocals, drums, bass, and instruments."
        badge="Phase 3" />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-black">1. Source Track</h3>
            <AssetPicker assetType="track" selected={selected} onChange={setSelected} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black">2. Stems to Extract</h3>
            <div className="grid grid-cols-2 gap-2">
              {STEM_TYPES.map(s => (
                <button key={s.id} onClick={() => toggleStem(s.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${stemTypes.includes(s.id)
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-border bg-muted/30 hover:border-emerald-500/40'}`}>
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <p className="text-xs font-bold">{s.label}</p>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={generate} disabled={running || selected.length === 0}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 gap-2 font-bold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? 'Separating…' : `Separate ${stemTypes.length} Stems`}
          </Button>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {!result && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <Layers className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Pick a track and select which stems to extract.</p>
            </div>
          )}

          {result?.stems?.map(stem => (
            <div key={stem.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-bold">{stem.title}</p>
                </div>
                <Badge variant="outline" className="capitalize">{stem.stem_type}</Badge>
              </div>
              <StudioAudioPlayer src={stem.file_url} title={stem.title} compact />
              <div className="flex flex-wrap gap-2">
                <AddToProjectButton asset={stem} tool="stem_creator" toolRoute="/stem-creator" />
              </div>
            </div>
          ))}

          {result?.stems?.[0] && <ProvenancePanel asset={result.stems[0]} />}
        </div>
      </div>
    </div>
  );
}