import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Feather, Sparkles, CheckCircle, Download, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CostBadge from '@/components/credits/CostBadge';
import InfoTip from '@/components/common/InfoTip';
import SkyeStyleControls from '@/components/music/SkyeStyleControls';
import ModelMastersPanel from '@/components/songwriting/ModelMastersPanel';
import TrainingFeedback from '@/components/training/TrainingFeedback';
import { useTrainingTelemetry } from '@/hooks/useTrainingTelemetry';
import { handleCreditError, refreshCreditsFromResponse, getProviderErrorMessage } from '@/utils/creditErrors';

const COST = 14;
// DiffRhythm 2's validated window. The 285s figure belongs to DiffRhythm 1 —
// v2 is only coherent to 210s, and it cannot render below 95s at all.
const MIN_DURATION = 95;
const MAX_DURATION = 210;
const POLL_INTERVAL_MS = 5000;

export default function SkyeGenerateTab() {
  const [style, setStyle] = useState({ stylePrompt: '', referenceUrl: '' });
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(95);
  const [seed, setSeed] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | submitting | rendering | done | error
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);
  const { sampleId, logGeneration, updateSample, markRegenerated } = useTrainingTelemetry();

  useEffect(() => () => { cancelledRef.current = true; }, []);

  // Strictly sequential poll: the next status read is scheduled only after the
  // previous resolves, so two finalizations can never overlap for one job.
  const pollUntilDone = useCallback(async (jobId) => {
    while (!cancelledRef.current) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (cancelledRef.current) return;
      let data;
      try {
        const res = await base44.functions.invoke('pollSkyeJob', { job_id: jobId });
        data = res.data;
      } catch {
        continue; // transient — keep polling
      }
      if (data?.status === 'completed') {
        refreshCreditsFromResponse(data);
        setResult(data);
        setStatusMsg('');
        setPhase('done');
        if (data.asset_id) updateSample({ outcome: 'saved', asset_id: data.asset_id });
        toast.success('🎵 Skye track ready!');
        return;
      }
      if (data?.status === 'failed') {
        setError(data.error || 'Generation failed');
        setPhase('error');
        toast.error(data.error || 'Skye generation failed');
        return;
      }
      setStatusMsg(data?.progress || 'Executing DiffRhythm 2 inference…');
    }
  }, [updateSample]);

  const generate = async () => {
    // Either conditioning path is enough — a reference recording carries the
    // style on its own, so a prompt is not required when one is attached.
    if (!style.stylePrompt.trim() && !style.referenceUrl.trim()) {
      toast.error('Describe the sound you want, or paste a reference track');
      return;
    }
    if (phase === 'submitting' || phase === 'rendering') return;
    cancelledRef.current = false;
    setPhase('submitting');
    setResult(null); setError(null); setStatusMsg('');
    markRegenerated();

    try {
      const numSeed = Number(seed);
      const res = await base44.functions.invoke('generateMusicSkye', {
        style_prompt: style.stylePrompt || undefined,
        lyrics: lyrics || undefined,
        reference_audio_url: style.referenceUrl.trim() || undefined,
        duration,
        seed: Number.isFinite(numSeed) && numSeed > 0 ? Math.round(numSeed) : undefined,
        title: title || undefined,
      });
      refreshCreditsFromResponse(res.data);
      if (res.data?.job_id) {
        setPhase('rendering');
        setStatusMsg('Skye accepted the job…');
        toast.success('Skye is composing…');
        // Opt-in telemetry — no-ops server-side without consent.
        logGeneration({
          provider: 'skye', model: 'DiffRhythm 2 (Skye)',
          prompt: style.stylePrompt, lyrics, duration,
        });
        pollUntilDone(res.data.job_id);
      } else {
        setPhase('error');
        setError('Unexpected response from Skye');
      }
    } catch (err) {
      setPhase('error');
      const data = err?.response?.data;
      const friendly = getProviderErrorMessage(err);
      const msg = friendly || data?.message || err.message || 'Generation failed';
      setError(msg);
      if (!handleCreditError(err)) toast.error(msg);
    }
  };

  const isBusy = phase === 'submitting' || phase === 'rendering';
  const audioUrl = result?.audio_url;

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-violet-200/90">
          <span className="font-bold text-violet-300">Skye:</span> our open-source fork of <span className="font-semibold">DiffRhythm 2</span>, self-hosted on our own Hugging Face engine. Semi-autoregressive block flow matching with phonetic lyric alignment — <span className="font-semibold">prose style steering</span>, or zero-shot reference cloning, and long-form output from {MIN_DURATION}s up to {MAX_DURATION}s.
        </p>
      </div>

      {/* Masters brief lands BEFORE the style controls so the creator sees the
          generated prose appear in the field they are about to edit. Tempo and
          key are folded into the prose — Skye has no numeric BPM input. */}
      <ModelMastersPanel dialect="skye" fallbackTopic={style.stylePrompt}
        onApply={({ style: s, lyrics: l, title: t }) => {
          setStyle((prev) => ({ ...prev, stylePrompt: s }));
          setLyrics(l);
          if (t && !title.trim()) setTitle(t);
        }} />

      <SkyeStyleControls value={style} onChange={setStyle} disabled={isBusy} />

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Lyrics (Optional)
          <InfoTip text="Raw lyrics work fine — Skye aligns them phonetically. You can also pin exact timings with LRC stamps, e.g. '[00:12.50] Walking down a dusty road'. Leave blank for an instrumental." />
        </p>
        <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={6} disabled={isBusy}
          placeholder={'[Verse]\nWalking down a dusty road…\n\nor timestamped:\n[00:12.50] Walking down a dusty road…'}
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none font-mono" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Title (Optional)</p>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
            placeholder="Auto-named" disabled={isBusy}
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Duration ({MIN_DURATION}–{MAX_DURATION}s)</p>
          <input type="number" min={MIN_DURATION} max={MAX_DURATION} value={duration} disabled={isBusy}
            onChange={(e) => setDuration(Math.min(Math.max(Number(e.target.value) || MIN_DURATION, MIN_DURATION), MAX_DURATION))}
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            Seed <InfoTip text="Fix a seed to reproduce the same take. Leave blank for a random result." />
          </p>
          <input type="number" min={1} value={seed} onChange={(e) => setSeed(e.target.value)}
            placeholder="Random" disabled={isBusy}
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
      </div>

      <AnimatePresence>
        {error && phase === 'error' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl border bg-red-500/10 border-red-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold mb-0.5 text-red-300">Generation Failed</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button size="sm" variant="ghost" onClick={() => { setError(null); setPhase('idle'); }} className="rounded-lg text-xs mt-2">Dismiss</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button onClick={generate} disabled={isBusy || (!style.stylePrompt.trim() && !style.referenceUrl.trim())}
        className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl font-bold text-base py-5 gap-2">
        <Feather className="w-5 h-5" />
        {isBusy ? (phase === 'submitting' ? 'Starting…' : 'Composing…') : 'Generate with Skye'}
        {!isBusy && <CostBadge cost={COST} />}
      </Button>

      <AnimatePresence>
        {isBusy && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin flex-shrink-0" />
              <p className="text-xs text-violet-300">{statusMsg || 'Skye is composing your track…'}</p>
            </div>
            <div className="h-1.5 rounded-full bg-violet-500/20 overflow-hidden">
              <motion.div className="h-full bg-violet-500 rounded-full"
                animate={{ x: ['-100%', '250%'] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                style={{ width: '40%' }} />
            </div>
            {duration > 120 && (
              <p className="text-[11px] text-muted-foreground">
                Long-form renders take a few minutes — you can leave this tab open.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {audioUrl && phase === 'done' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-violet-500/30 p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-bold text-violet-400">Track Ready</span>
              <Badge variant="outline" className="text-xs">Skye · DiffRhythm 2</Badge>
              <Badge variant="outline" className="text-xs">WAV</Badge>
              {style.referenceUrl.trim() && <Badge variant="outline" className="text-xs">Style cloned</Badge>}
            </div>

            {result?.cover_image_url && (
              <div className="flex items-center gap-3">
                <img src={result.cover_image_url} alt="Cover" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-border" />
                <p className="text-xs text-muted-foreground">Auto-generated cover art</p>
              </div>
            )}

            <audio controls className="w-full rounded-xl" src={audioUrl} />
            <TrainingFeedback sampleId={sampleId} modelName="Skye" />
            <div className="flex gap-2 flex-wrap">
              <a href={audioUrl} download className="flex-1">
                <Button variant="outline" className="w-full gap-2 rounded-xl">
                  <Download className="w-4 h-4" /> Download WAV
                </Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Saved to your library automatically.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}