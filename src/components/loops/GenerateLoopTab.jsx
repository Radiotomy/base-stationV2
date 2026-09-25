import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Sparkles, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LoopCard from './LoopCard';
import LoopSpecBadges from './LoopSpecBadges';
import { finishSoundForgeLoop } from '@/utils/finishSoundForgeLoop';

const CATEGORY_OPTIONS = ['loop', 'one_shot', 'drum_loop', 'bass_loop', 'melodic_loop', 'vocal_chop', 'fx', 'sample'];

export default function GenerateLoopTab() {
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState('loop');
  const [bpm, setBpm] = useState('');
  const [duration, setDuration] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Stable Audio hands back MP3; the finishing stage needs PCM. Decode in the
  // browser and let the server finish it, so the loop is bar-locked and seamless
  // before the user ever auditions or saves it.
  const settle = async (audioUrl, jobId) => {
    setResult({ audio_url: audioUrl, job_id: jobId, loop: null });
    if (!/\.mp3(\?|$)/i.test(audioUrl)) return;
    setFinishing(true);
    try {
      const done = await finishSoundForgeLoop({ audioUrl, jobId, bpm, category });
      if (done?.audio_url) setResult({ audio_url: done.audio_url, job_id: jobId, loop: done.loop });
    } catch {
      toast.info('Loop is ready, but automatic finishing was skipped.');
    } finally {
      setFinishing(false);
    }
  };

  // Poll until the render lands (up to ~3 min), so the user never has to
  // manually retry a generation they already paid for.
  const waitForJob = async (jobId) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const p = await base44.functions.invoke('pollGenerationJob', { job_id: jobId });
      if (p.data?.status === 'completed') return p.data;
      if (p.data?.status === 'failed') throw new Error(p.data.error_message || 'Generation failed');
    }
    return null;
  };

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
        toast.success('Generated with BASE Forge!');
        await settle(res.data.audio_url, res.data.job_id);
      } else if (res.data?.job_id) {
        // Cold GPU — keep waiting for the user instead of making them retry.
        const done = await waitForJob(res.data.job_id);
        if (done) {
          toast.success('Generated with BASE Forge!');
          await settle(done.audio_url, res.data.job_id);
        } else {
          toast.info('Still rendering — check Studio History in a moment.');
        }
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
        bpm: result.loop?.bpm || (bpm ? Number(bpm) : undefined),
        duration_seconds: result.loop?.duration_seconds || duration,
        collection_name: 'BASE Forge',
        license: 'AI Generated',
        loop_spec: result.loop || undefined,
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
        Generate original loops, one-shots, and sound effects with <strong>BASE Forge</strong> —
        our own AI audio engine, built on an open-source foundation model and tuned for short-form
        loop and sample generation, running Stable Audio 2.5. Every result is finished automatically: trimmed, locked to a whole
        number of bars, seamlessly crossfaded at the loop point and normalized to −1 dBFS, exported as
        WAV. 2 credits per generation.
      </p>
      <div className="merc-card rounded-xl p-4 space-y-3">
        <Textarea
          placeholder="Describe the sound — e.g. '128 BPM tech house drum loop with punchy kick and hi-hats'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Sound type</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground capitalize"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c} className="bg-[#14100C] text-white">{c.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Tempo (BPM, optional)</span>
            <Input placeholder="e.g. 120" type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Length (seconds, 1–30)</span>
            <Input placeholder="8" type="number" min={1} max={30} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 8)} />
          </label>
        </div>
        <Button onClick={generate} disabled={generating} className="w-full">
          {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {generating ? 'Generating…' : 'Generate with BASE Forge'}
        </Button>
      </div>

      {result && (
        <div className="space-y-2">
          <LoopCard
            title={prompt.slice(0, 60)}
            subtitle={`${category} · BASE Forge`}
            audioUrl={result.audio_url}
            onAction={saveToLibrary}
            actionLabel="Save to My Loops"
            actionIcon={Save}
            actionLoading={saving || finishing}
          />
          {finishing ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Finishing — trimming, locking to the bar and normalizing…
            </p>
          ) : (
            <LoopSpecBadges info={result.loop} />
          )}
        </div>
      )}
    </div>
  );
}