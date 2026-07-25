import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FinetuneGeneratePanel({ finetune }) {
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState([60]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error('Describe the track you want');
    setGenerating(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('generateMusicFinetune', {
        record_id: finetune.id,
        prompt: prompt.trim(),
        title: title.trim(),
        duration_seconds: duration[0],
      });
      if (res.data?.error) throw new Error(res.data.error);
      setResult(res.data);
      toast.success(`Track generated — saved to your Asset Gallery (${res.data.credits_remaining} credits left)`);
    } catch (e) {
      toast.error(e.response?.data?.message || e.response?.data?.error || e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" /> Generate with "{finetune.name}"
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Your finetune controls the style — the prompt controls content, mood, tempo, and language.
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Track Title (Optional)</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={`Auto: ${finetune.name} — ${prompt.slice(0, 40) || 'track'}`}
          maxLength={80}
          className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <Textarea
        placeholder='e.g. "Upbeat track with warm vocals at 124 BPM about summer nights"'
        value={prompt} onChange={e => setPrompt(e.target.value)}
        rows={3} maxLength={2000}
      />

      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-muted-foreground w-24 flex-shrink-0">Length: {duration[0]}s</span>
        <Slider value={duration} onValueChange={setDuration} min={10} max={300} step={5} className="flex-1" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Cost: <strong className="text-foreground">10 credits</strong> per track</p>
        <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Composing…</> : <><Sparkles className="w-4 h-4" /> Generate Track</>}
        </Button>
      </div>

      {result?.audio_url && (
        <div className="p-3 rounded-xl bg-secondary/60 border border-border space-y-2">
          <p className="text-xs font-semibold text-emerald-400 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved to your Asset Gallery with full finetune provenance
          </p>
          <audio controls src={result.audio_url} className="w-full" />
        </div>
      )}
    </div>
  );
}