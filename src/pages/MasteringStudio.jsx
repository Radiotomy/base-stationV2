import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import StudioPageHeader from '@/components/studio/StudioPageHeader';
import AssetPicker from '@/components/studio/AssetPicker';
import StudioAudioPlayer from '@/components/audio/StudioAudioPlayer';
import ProvenancePanel from '@/components/studio/ProvenancePanel';
import AddToProjectButton from '@/components/studio/AddToProjectButton';
import InfoTip from '@/components/common/InfoTip';

const STYLES = [
  { id: 'streaming', label: 'Streaming', desc: '-14 LUFS · Spotify/Apple Music ready' },
  { id: 'loud',      label: 'Loud',      desc: '-8 LUFS · Maximum punch' },
  { id: 'balanced',  label: 'Balanced',  desc: '-12 LUFS · Versatile, dynamic' },
  { id: 'warm',      label: 'Warm',      desc: '-13 LUFS · Analog character' },
  { id: 'club',      label: 'Club',      desc: '-7 LUFS · Bass-forward, heavy' },
  { id: 'vinyl',     label: 'Vinyl',     desc: '-16 LUFS · Smooth, dynamic' },
];

export default function MasteringStudio() {
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get('assetId');

  const [selected, setSelected] = useState(preselected ? [preselected] : []);
  const [style, setStyle] = useState('streaming');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (selected.length === 0) { toast.error('Pick a track first'); return; }
    setRunning(true);
    try {
      const r = await base44.functions.invoke('masterTrack', { assetId: selected[0], style });
      setResult(r.data);
      toast.success('Track mastered!', { icon: '✨' });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Mastering failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Sparkles} accent="amber"
        title="AI Mastering Studio"
        subtitle="Apply pro-grade mastering profiles to any track. Streaming, club, vinyl, and more."
        badge="Phase 3" />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              1. Track
              <InfoTip text="Pick any track from your library. The AI master applies EQ, compression and limiting to hit the target loudness." />
            </h3>
            <AssetPicker assetType="track" selected={selected} onChange={setSelected} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              2. Mastering Style
              <InfoTip text="Streaming (-14 LUFS) is the safe default for Spotify/Apple Music/YouTube. Use Club for DJ sets, Vinyl for analog warmth and dynamic range." />
            </h3>
            <div className="space-y-2">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`w-full p-3 rounded-xl border text-left transition-all ${style === s.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-border bg-muted/30 hover:border-amber-500/40'}`}>
                  <p className="text-sm font-bold">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={generate} disabled={running || selected.length === 0}
            className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 gap-2 font-bold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? 'Mastering…' : 'Master Track'}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!result && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Pick a track and a mastering style.</p>
            </div>
          )}

          {result?.asset && (
            <>
              <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{result.asset.title}</p>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{result.profile?.lufs} LUFS</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{result.profile?.eq} EQ</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{result.profile?.compression}</Badge>
                    </div>
                  </div>
                  <AddToProjectButton asset={result.asset} tool="mastering_studio" toolRoute="/mastering-studio" />
                </div>
                <StudioAudioPlayer src={result.asset.file_url} title={result.asset.title} compact />
              </div>
              <ProvenancePanel asset={result.asset} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}