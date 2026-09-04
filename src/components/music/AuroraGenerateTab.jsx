import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Sunrise, Sparkles, CheckCircle, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CostBadge from '@/components/credits/CostBadge';
import InfoTip from '@/components/common/InfoTip';
import MiniMaxAttribution from '@/components/music/aurora/MiniMaxAttribution';
import ModelMastersPanel from '@/components/songwriting/ModelMastersPanel';
import { MODEL_DIALECTS } from '@/utils/modelLyricDialects';
import AuroraCaptionBuilder from '@/components/music/aurora/AuroraCaptionBuilder';
import AuroraLyricEditor from '@/components/music/aurora/AuroraLyricEditor';
import TrainingFeedback from '@/components/training/TrainingFeedback';
import { useTrainingTelemetry } from '@/hooks/useTrainingTelemetry';
import { EMPTY_CAPTION, resolveAuroraPrompt } from '@/lib/music/auroraCaption';
import { handleCreditError, refreshCreditsFromResponse, getProviderErrorMessage } from '@/utils/creditErrors';

const COST = 18;
const MIN_DURATION = 30;
const MAX_DURATION = 300;
const POLL_INTERVAL_MS = 6000;

export default function AuroraGenerateTab() {
  const [mode, setMode] = useState('structured');
  const [caption, setCaption] = useState(EMPTY_CAPTION);
  const [prose, setProse] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(120);
  const [seed, setSeed] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | submitting | rendering | done | error
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);
  const { sampleId, logGeneration, updateSample, markRegenerated } = useTrainingTelemetry();

  useEffect(() => () => { cancelledRef.current = true; }, []);

  const compiledPrompt = resolveAuroraPrompt({ mode, prose, caption });

  // A Masters brief lands in the caption BUILDER, not in a hidden prompt string:
  // the creator keeps every field editable, and structured mode is forced on so
  // what they see is what the engine gets.
  const applyMastersBrief = ({ brief, genre, mood, lyrics: written, title: writtenTitle }) => {
    setCaption((prev) => ({ ...prev, ...MODEL_DIALECTS.aurora.toCaptionFields(brief, { genre, mood }) }));
    setMode('structured');
    if (written) setLyrics(MODEL_DIALECTS.aurora.toLyrics(written));
    if (writtenTitle && !title) setTitle(writtenTitle);
  };

  // Strictly sequential poll: the next read is scheduled only after the previous
  // resolves, so two finalizations can never overlap for one job.
  const pollUntilDone = useCallback(async (jobId) => {
    while (!cancelledRef.current) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (cancelledRef.current) return;
      let data;
      try {
        const res = await base44.functions.invoke('pollAuroraJob', { job_id: jobId });
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
        toast.success('🌅 Aurora track ready!');
        return;
      }
      if (data?.status === 'failed') {
        setError(data.error || 'Generation failed');
        setPhase('error');
        toast.error(data.error || 'Aurora generation failed');
        return;
      }
      setStatusMsg(data?.progress || 'Composing with MiniMax-Music3…');
    }
  }, [updateSample]);

  const generate = async () => {
    if (!compiledPrompt) {
      toast.error(mode === 'prose' ? 'Describe the song you want' : 'Fill in at least a genre or an arrangement detail');
      return;
    }
    if (phase === 'submitting' || phase === 'rendering') return;
    cancelledRef.current = false;
    setPhase('submitting');
    setResult(null); setError(null); setStatusMsg('');
    markRegenerated();

    try {
      const numSeed = Number(seed);
      const res = await base44.functions.invoke('generateMusicAurora', {
        prompt: compiledPrompt,
        lyrics: lyrics || undefined,
        duration,
        seed: Number.isFinite(numSeed) && numSeed > 0 ? Math.round(numSeed) : undefined,
        title: title || undefined,
        caption_mode: mode,
        caption_fields: mode === 'structured' ? caption : undefined,
      });
      refreshCreditsFromResponse(res.data);
      if (res.data?.job_id) {
        setPhase('rendering');
        setStatusMsg('Aurora accepted the job…');
        toast.success('Aurora is composing…');
        logGeneration({
          provider: 'aurora', model: 'Aurora (MiniMax-Music3)',
          prompt: compiledPrompt, lyrics, duration,
        });
        pollUntilDone(res.data.job_id);
      } else {
        setPhase('error');
        setError('Unexpected response from Aurora');
      }
    } catch (err) {
      setPhase('error');
      const friendly = getProviderErrorMessage(err);
      const msg = friendly || err?.response?.data?.message || err?.response?.data?.error || err.message || 'Generation failed';
      setError(msg);
      if (!handleCreditError(err)) toast.error(msg);
    }
  };

  const isBusy = phase === 'submitting' || phase === 'rendering';
  const audioUrl = result?.audio_url;
  const mins = Math.floor(duration / 60), secs = duration % 60;

  return (
    <div className="space-y-6">
      <MiniMaxAttribution />

      <ModelMastersPanel
        dialect="aurora"
        onApply={applyMastersBrief}
        fallbackTopic={prose}
      />

      <AuroraCaptionBuilder
        mode={mode} onModeChange={setMode}
        caption={caption} onCaptionChange={setCaption}
        prose={prose} onProseChange={setProse}
        disabled={isBusy}
      />

      <AuroraLyricEditor value={lyrics} onChange={setLyrics} disabled={isBusy} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Title (Optional)</p>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
            placeholder="Auto-named" disabled={isBusy}
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            Length — {mins}:{String(secs).padStart(2, '0')}
            <InfoTip text="Aurora renders complete songs natively, up to five minutes, holding theme, vocal identity and arrangement across the whole length." />
          </p>
          <input type="range" min={MIN_DURATION} max={MAX_DURATION} step={5} value={duration} disabled={isBusy}
            onChange={(e) => setDuration(Number(e.target.value))} className="w-full accent-amber-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            Seed <InfoTip text="Fix a seed to reproduce the exact same take. Leave blank for a fresh result each render." />
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

      <Button onClick={generate} disabled={isBusy || !compiledPrompt}
        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-xl font-bold text-base py-5 gap-2">
        <Sunrise className="w-5 h-5" />
        {isBusy ? (phase === 'submitting' ? 'Starting…' : 'Composing…') : 'Generate with Aurora'}
        {!isBusy && <CostBadge cost={COST} />}
      </Button>

      <AnimatePresence>
        {isBusy && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin flex-shrink-0" />
              <p className="text-xs text-amber-200">{statusMsg || 'Aurora is composing your song…'}</p>
            </div>
            <div className="h-1.5 rounded-full bg-amber-500/20 overflow-hidden">
              <motion.div className="h-full bg-amber-500 rounded-full"
                animate={{ x: ['-100%', '250%'] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                style={{ width: '40%' }} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              A full-length song takes a few minutes to render — you can leave this tab open.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {audioUrl && phase === 'done' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-amber-500/30 p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-amber-400">Song Ready</span>
              <MiniMaxAttribution variant="badge" />
              <Badge variant="outline" className="text-xs">
                {result?.sample_rate ? `${Math.round(result.sample_rate / 1000)}kHz ` : ''}Stereo WAV
              </Badge>
            </div>

            {result?.cover_image_url && (
              <div className="flex items-center gap-3">
                <img src={result.cover_image_url} alt="Cover" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-border" />
                <p className="text-xs text-muted-foreground">Auto-generated cover art</p>
              </div>
            )}

            <audio controls className="w-full rounded-xl" src={audioUrl} />
            <TrainingFeedback sampleId={sampleId} modelName="Aurora" />
            <a href={audioUrl} download className="block">
              <Button variant="outline" className="w-full gap-2 rounded-xl">
                <Download className="w-4 h-4" /> Download WAV
              </Button>
            </a>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Saved to your library automatically, lossless and ready for BASE Mark.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}