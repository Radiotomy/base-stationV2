import { useState } from 'react';
import useKitsJob from '@/hooks/useKitsJob';
import KitsVoicePicker from '@/components/kits/KitsVoicePicker';
import KitsQueueStatus from '@/components/kits/KitsQueueStatus';
import { Mic2, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import StudioPageHeader from '@/components/studio/StudioPageHeader';
import AssetPicker from '@/components/studio/AssetPicker';
import StudioAudioPlayer from '@/components/audio/StudioAudioPlayer';
import ProvenancePanel from '@/components/studio/ProvenancePanel';
import AddToProjectButton from '@/components/studio/AddToProjectButton';

const HARMONY_TYPES = [
  { id: '3rd', label: 'Major Third', desc: 'Bright, classic harmony' },
  { id: '5th', label: 'Perfect Fifth', desc: 'Strong, anthemic' },
  { id: 'octave', label: 'Octave', desc: 'Doubled, fuller body' },
  { id: 'unison', label: 'Unison Stack', desc: 'Thicker single voice' },
];

export default function VocalHarmonizer() {
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get('assetId');

  const [selected, setSelected] = useState(preselected ? [preselected] : []);
  const [harmonyType, setHarmonyType] = useState('3rd');
  const [voice, setVoice] = useState(null);
  const job = useKitsJob();
  const running = job.busy;
  const result = job.status === 'completed' ? job.asset : null;

  const generate = () => {
    if (selected.length === 0) { toast.error('Pick a vocal track first'); return; }
    if (!voice) { toast.error('Pick a harmony voice'); return; }
    job.start('generateHarmonies', { assetId: selected[0], harmonyType, voiceModelId: voice.model_id });
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Mic2} accent="pink"
        title="Vocal Harmonizer"
        subtitle="Add lush AI-generated harmonies to any vocal track."
        badge="Phase 3" />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black">1. Vocal Track</h3>
            <AssetPicker assetType="track" selected={selected} onChange={setSelected} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black">2. Harmony Type</h3>
            <div className="space-y-2">
              {HARMONY_TYPES.map(h => (
                <button key={h.id} onClick={() => setHarmonyType(h.id)}
                  className={`w-full p-3 rounded-xl border text-left transition-all ${harmonyType === h.id
                    ? 'border-pink-500 bg-pink-500/10'
                    : 'border-border bg-muted/30 hover:border-pink-500/40'}`}>
                  <p className="text-sm font-bold">{h.label}</p>
                  <p className="text-xs text-muted-foreground">{h.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black">3. Harmony Voice</h3>
            <KitsVoicePicker value={voice} onChange={setVoice} />
          </div>

          <KitsQueueStatus job={job} />
          <Button onClick={generate} disabled={running || selected.length === 0}
            className="w-full rounded-xl bg-pink-600 hover:bg-pink-500 gap-2 font-bold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? 'Generating…' : 'Generate Harmony'}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!result && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <Mic2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Pick a vocal track and a harmony type.</p>
            </div>
          )}

          {result && (
            <>
              <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold truncate">{result.title}</p>
                  <AddToProjectButton asset={result} tool="vocal_harmonizer" toolRoute="/vocal-harmonizer" />
                </div>
                <StudioAudioPlayer src={result.file_url} title={result.title} compact />
              </div>
              <ProvenancePanel asset={result} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}