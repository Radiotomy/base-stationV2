import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Combine, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import StudioPageHeader from '@/components/studio/StudioPageHeader';
import AssetPicker from '@/components/studio/AssetPicker';
import StudioAudioPlayer from '@/components/audio/StudioAudioPlayer';
import ProvenancePanel from '@/components/studio/ProvenancePanel';
import AddToProjectButton from '@/components/studio/AddToProjectButton';

export default function MashupStudio() {
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get('assetId');

  const [selected, setSelected] = useState(preselected ? [preselected] : []);
  const [bpm, setBpm] = useState('');
  const [musicalKey, setMusicalKey] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (selected.length < 2) { toast.error('Select at least 2 tracks'); return; }
    setRunning(true);
    try {
      const opts = {};
      if (bpm) opts.bpm = parseInt(bpm);
      if (musicalKey) opts.key = musicalKey;
      const r = await base44.functions.invoke('generateMashup', { assetIds: selected, options: opts });
      setResult(r.data?.asset);
      toast.success('Mashup created!', { icon: '🎚️' });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Mashup failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Combine} accent="amber"
        title="Mashup Studio"
        subtitle="Blend 2–4 tracks into one. Auto-detects BPM/key and aligns them automatically."
        badge="Phase 3" />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black">1. Pick 2–4 Tracks</h3>
            <AssetPicker assetType="track" multi max={4}
              selected={selected} onChange={setSelected} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black">2. Override (Optional)</h3>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Target BPM</label>
              <Input value={bpm} onChange={e => setBpm(e.target.value)} placeholder="Auto-detect" type="number" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Target Key</label>
              <Input value={musicalKey} onChange={e => setMusicalKey(e.target.value)} placeholder="e.g., Cm, F#" className="rounded-xl" />
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-xs text-amber-300">⚠️ Loudly catalog content cannot be mashed with Audius content (legal separation).</p>
          </div>

          <Button onClick={generate} disabled={running || selected.length < 2}
            className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 gap-2 font-bold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? 'Mashing…' : `Mash ${selected.length} Tracks`}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!result && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <Combine className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Pick 2–4 tracks to blend.</p>
            </div>
          )}

          {result && (
            <>
              <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{result.title}</p>
                    <div className="flex gap-1.5 mt-1">
                      {result.metadata?.bpm && <Badge variant="outline" className="text-xs">{result.metadata.bpm} BPM</Badge>}
                      {result.metadata?.key && <Badge variant="outline" className="text-xs">{result.metadata.key}</Badge>}
                    </div>
                  </div>
                  <AddToProjectButton asset={result} tool="mashup_studio" toolRoute="/mashup-studio" />
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