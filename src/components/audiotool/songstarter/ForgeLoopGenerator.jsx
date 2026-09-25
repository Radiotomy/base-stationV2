import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { runForgeLoop, errorText } from '@/lib/audiotool/songstarterGen';
import AssetPreviewPlayer from './AssetPreviewPlayer';

const CATEGORIES = ['loop', 'drum_loop', 'bass_loop', 'melodic_loop', 'vocal_chop', 'one_shot'];

export default function ForgeLoopGenerator() {
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState('drum_loop');
  const [bpm, setBpm] = useState('120');
  const [duration, setDuration] = useState(8);
  const [state, setState] = useState({ loading: false, error: '', result: null });

  const generate = async () => {
    setState({ loading: true, error: '', result: null });
    try {
      const out = await runForgeLoop({ prompt: prompt.trim(), category, bpm, duration });
      setState({ loading: false, error: '', result: { ...out, prompt: prompt.trim(), category } });
    } catch (e) {
      setState({ loading: false, error: errorText(e), result: null });
    }
  };

  const r = state.result;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tempo-locked loops from BASE Forge (Stable Audio 2.5) — trimmed, bar-locked and exported as WAV. 2 credits each.
      </p>
      <Textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)}
        placeholder="Dusty boom-bap break with swung hats and a vinyl-warm snare" />
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Sound type</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground capitalize">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Tempo (BPM)</span>
          <Input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="120" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Length (seconds)</span>
          <Input type="number" min={1} max={30} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 8)} placeholder="8" />
        </label>
      </div>
      <Button className="merc-button" onClick={generate} disabled={!prompt.trim() || !Number(bpm) || state.loading}>
        {state.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {state.loading ? 'Generating with BASE Forge…' : 'Generate loop'}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {r && (
        <AssetPreviewPlayer url={r.audioUrl} title={r.prompt.slice(0, 60)}
          subtitle={`${r.category.replace('_', ' ')} · ${r.bpm || '?'} BPM · BASE Forge`}
          bpm={r.bpm} aiTool="songstarter_loop" prompt={r.prompt} />
      )}
    </div>
  );
}