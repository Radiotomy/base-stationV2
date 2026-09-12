import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Lightbulb, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CostBadge from '@/components/credits/CostBadge';
import InfoTip from '@/components/common/InfoTip';
import BaseEngineNotice from '@/components/music/BaseEngineNotice';
import GenreMoodPicker from '@/components/music/GenreMoodPicker';
import TrainingFeedback from '@/components/training/TrainingFeedback';
import InspireTaskControls from '@/components/music/inspire/InspireTaskControls';
import InspireResultCard from '@/components/music/inspire/InspireResultCard';
import { useTrainingTelemetry } from '@/hooks/useTrainingTelemetry';
import { handleCreditError, refreshCreditsFromResponse, getProviderErrorMessage } from '@/utils/creditErrors';

const COST = 13;
const POLL_INTERVAL_MS = 5000;

// Inspire is instrumental — upstream released no vocal or lyric channel — so
// there is deliberately no lyrics field here. A lyric box the engine discards
// would be worse than none at all.
export default function InspireGenerateTab() {
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [release, setRelease] = useState({ genre: '', mood: '' });
  const [cfg, setCfg] = useState({
    task: 'text-to-music', sourceId: '',
    model: 'InspireMusic-1.5B-Long', section: 'intro', duration: 60, seed: '',
  });
  const [phase, setPhase] = useState('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState(null);
  const [sourceTitle, setSourceTitle] = useState('');
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);
  const { sampleId, logGeneration, updateSample, markRegenerated } = useTrainingTelemetry();

  useEffect(() => () => { cancelledRef.current = true; }, []);

  // Strictly sequential: the next status read is scheduled only after the
  // previous resolves, so two finalizations can never overlap for one job.
  const pollUntilDone = useCallback(async (jobId) => {
    while (!cancelledRef.current) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (cancelledRef.current) return;
      let data;
      try {
        const res = await base44.functions.invoke('pollInspireJob', { job_id: jobId });
        data = res.data;
      } catch {
        continue;
      }
      if (data?.status === 'completed') {
        refreshCreditsFromResponse(data);
        setResult(data);
        setStatusMsg('');
        setPhase('done');
        if (data.asset_id) updateSample({ outcome: 'saved', asset_id: data.asset_id });
        toast.success('🎼 Inspire track ready!');
        return;
      }
      if (data?.status === 'failed') {
        setError(data.error || 'Generation failed');
        setPhase('error');
        toast.error(data.error || 'Inspire generation failed');
        return;
      }
      setStatusMsg(data?.progress || 'Running InspireMusic inference…');
    }
  }, [updateSample]);

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error('Describe the music you want Inspire to compose');
      return;
    }
    if (cfg.task === 'continuation' && !cfg.sourceId) {
      toast.error('Pick a track from your library to continue from');
      return;
    }
    if (phase === 'submitting' || phase === 'rendering') return;
    cancelledRef.current = false;
    setPhase('submitting');
    setResult(null); setError(null); setStatusMsg('');
    markRegenerated();

    try {
      const numSeed = Number(cfg.seed);
      const res = await base44.functions.invoke('generateMusicInspire', {
        prompt,
        task: cfg.task,
        continuation_asset_id: cfg.task === 'continuation' ? cfg.sourceId : undefined,
        section: cfg.section,
        duration: cfg.duration,
        model: cfg.model,
        seed: Number.isFinite(numSeed) && numSeed > 0 ? Math.round(numSeed) : undefined,
        title: title || undefined,
        genre: release.genre || undefined,
        mood: release.mood || undefined,
      });
      refreshCreditsFromResponse(res.data);
      if (res.data?.job_id) {
        setPhase('rendering');
        setStatusMsg('Inspire accepted the job…');
        setSourceTitle(res.data.continuation_source_title || '');
        toast.success('Inspire is composing…');
        logGeneration({
          provider: 'inspire', model: cfg.model,
          prompt, duration: cfg.duration,
        });
        pollUntilDone(res.data.job_id);
      } else {
        setPhase('error');
        setError('Unexpected response from Inspire');
      }
    } catch (err) {
      setPhase('error');
      const friendly = getProviderErrorMessage(err);
      const msg = friendly || err?.response?.data?.message || err.message || 'Generation failed';
      setError(msg);
      if (!handleCreditError(err)) toast.error(msg);
    }
  };

  const isBusy = phase === 'submitting' || phase === 'rendering';

  return (
    <div className="space-y-6">
      <BaseEngineNotice accent="cyan" name="Inspire">
        Built on the open-source InspireMusic toolkit and re-tuned for BASE Station. Renders{' '}
        <span className="font-semibold">instrumental</span> music at{' '}
        <span className="font-semibold">native 48kHz stereo</span> — the highest-fidelity source
        on the platform — and it is the one engine that can keep composing from your own audio.
      </BaseEngineNotice>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Describe the Music
          <InfoTip text="Write a sentence or two about the production — instruments, feel, setting. Inspire reads natural-language descriptions, not comma-separated tags, and English works best." />
        </p>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} disabled={isBusy} maxLength={600}
          placeholder="Soothing instrumental jazz with a touch of Bossa Nova, warm upright bass and brushed drums, perfect for a late-night restaurant."
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
      </div>

      <InspireTaskControls value={cfg} onChange={setCfg} disabled={isBusy} />

      <GenreMoodPicker genre={release.genre} mood={release.mood} onChange={setRelease} disabled={isBusy} />

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Title (Optional)</p>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
          placeholder="Auto-named" disabled={isBusy}
          className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
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

      <Button onClick={generate} disabled={isBusy || !prompt.trim()}
        className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 rounded-xl font-bold text-base py-5 gap-2">
        <Lightbulb className="w-5 h-5" />
        {isBusy ? (phase === 'submitting' ? 'Starting…' : 'Composing…') : 'Generate with Inspire'}
        {!isBusy && <CostBadge cost={COST} />}
      </Button>

      <AnimatePresence>
        {isBusy && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin flex-shrink-0" />
              <p className="text-xs text-teal-200">{statusMsg || 'Inspire is composing your track…'}</p>
            </div>
            <div className="h-1.5 rounded-full bg-teal-500/20 overflow-hidden">
              <motion.div className="h-full bg-teal-500 rounded-full"
                animate={{ x: ['-100%', '250%'] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                style={{ width: '40%' }} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              You can leave this page — the finished track saves to your library either way.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result?.audio_url && phase === 'done' && (
          <div className="space-y-4">
            <InspireResultCard result={result} isContinuation={cfg.task === 'continuation'} sourceTitle={sourceTitle} />
            <TrainingFeedback sampleId={sampleId} modelName="Inspire" />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}