import { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { runSfx, errorText } from '@/lib/audiotool/songstarterGen';
import AssetPreviewPlayer from './AssetPreviewPlayer';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';

const PRESETS = [
  { label: 'Riser', text: 'Tension-building white-noise riser sweeping up into a drop', duration: 8, loop: false },
  { label: 'Impact', text: 'Huge cinematic sub-bass impact with a short metallic tail', duration: 3, loop: false },
  { label: 'Texture', text: 'Evolving airy granular ambient texture, wide and soft', duration: 10, loop: true },
];

export default function SfxGenerator() {
  const [text, setText] = useState('');
  const [duration, setDuration] = useState(6);
  const [loop, setLoop] = useState(false);
  const [state, setState] = useState({ loading: false, error: '', result: null });

  const applyPreset = (p) => { setText(p.text); setDuration(p.duration); setLoop(p.loop); };

  const generate = async () => {
    setState({ loading: true, error: '', result: null });
    try {
      const out = await runSfx({ text: text.trim(), duration, loop });
      setState({ loading: false, error: '', result: { ...out, text: text.trim() } });
    } catch (e) {
      setState({ loading: false, error: errorText(e), result: null });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Risers, impacts and textures from ElevenLabs Sound Effects, converted to WAV. 3 credits each. <InfoTip text={TIPS.sfx} /></p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p)}
            className="px-2.5 py-1 rounded-full text-xs border border-border text-muted-foreground hover:text-foreground">{p.label}</button>
        ))}
      </div>
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Reverse cymbal swell into a gated snare hit" />
      <div className="flex items-center gap-4">
        <Input type="number" min={0.5} max={30} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 6)} className="w-28" />
        <label className="flex items-center gap-2 text-sm"><Switch checked={loop} onCheckedChange={setLoop} /> Seamless loop</label>
      </div>
      <Button className="merc-button" onClick={generate} disabled={!text.trim() || state.loading}>
        {state.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {state.loading ? 'Generating…' : 'Generate sound effect'}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.result && (
        <AssetPreviewPlayer url={state.result.audioUrl} title={state.result.text.slice(0, 60)}
          subtitle="Sound effect · ElevenLabs" aiTool="songstarter_sfx" prompt={state.result.text} />
      )}
    </div>
  );
}