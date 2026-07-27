import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Sparkles, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LoopCard from './LoopCard';

const CATEGORY_OPTIONS = ['loop', 'one_shot', 'drum_loop', 'bass_loop', 'melodic_loop', 'vocal_chop', 'fx', 'sample'];

export default function GenerateLoopTab() {
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState('loop');
  const [bpm, setBpm] = useState('');
  const [duration, setDuration] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) { toast.error('Describe the loop or sample you want'); return; }
    setGenerating(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('generateLoopSample', {
        prompt, category, bpm: bpm ? Number(bpm) : undefined, duration_seconds: duration,
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (res.data?.status === 'completed') {
        setResult({ audio_url: res.data.audio_url, job_id: res.data.job_id });
        toast.success('Generated with BASE SoundForge!');
      } else if (res.data?.job_id) {
        toast.info('Still processing — this can take a bit, try again shortly.');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveToLibrary = async () => {
    if (!result?.audio_url) return;
    setSaving(true);
    try {
      const me = await base44.auth.me();
      await base44.entities.LoopSample.create({
        user_id: me.id,
        user_name: me.full_name,
        title: prompt.slice(0, 60),
        file_url: result.audio_url,
        category,
        source: 'soundforge',
        bpm: bpm ? Number(bpm) : undefined,
        duration_seconds: duration,
        collection_name: 'BASE SoundForge',
        license: 'AI Generated',
        is_public: false,
      });
      toast.success('Saved to My Loops');
    } catch (e) {
      toast.error('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Generate original loops, one-shots, and sound effects with <strong>BASE SoundForge</strong> —
        our own AI audio engine, built on an open-source foundation model and tuned for short-form
        loop and sample generation. 2 credits per generation.
      </p>
      <div className="merc-card rounded-xl p-4 space-y-3">
        <Textarea
          placeholder="Describe the sound — e.g. '128 BPM tech house drum loop with punchy kick and hi-hats'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <div className="grid sm:grid-cols-3 gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
          <Input placeholder="BPM (optional)" type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} />
          <Input placeholder="Duration (sec)" type="number" min={1} max={30} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 8)} />
        </div>
        <Button onClick={generate} disabled={generating} className="w-full">
          {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {generating ? 'Generating…' : 'Generate with BASE SoundForge'}
        </Button>
      </div>

      {result && (
        <LoopCard
          title={prompt.slice(0, 60)}
          subtitle={`${category} · BASE SoundForge`}
          audioUrl={result.audio_url}
          onAction={saveToLibrary}
          actionLabel="Save to My Loops"
          actionIcon={Save}
          actionLoading={saving}
        />
      )}
    </div>
  );
}