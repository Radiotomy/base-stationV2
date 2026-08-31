import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Waves, Sparkles, CheckCircle, Download, AlertCircle, Info, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CostBadge from '@/components/credits/CostBadge';
import InfoTip from '@/components/common/InfoTip';
import { handleCreditError, refreshCreditsFromResponse, getProviderErrorMessage } from '@/utils/creditErrors';
import ModelMastersPanel from '@/components/songwriting/ModelMastersPanel';
import SongIdeaAssistant from '@/components/music/SongIdeaAssistant';
import TrainingFeedback from '@/components/training/TrainingFeedback';
import { useTrainingTelemetry } from '@/hooks/useTrainingTelemetry';

const COST = 12;
// HeartMuLa 3B's own architectural ceiling (6 min) — not a cost cap.
const MAX_LENGTH_SEC = 360;
const POLL_INTERVAL_MS = 4000;

export default function SirenSongGenerateTab() {
  const [tags, setTags] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState('');
  const [lengthSec, setLengthSec] = useState(30);
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
        const res = await base44.functions.invoke('pollSirenSongJob', { job_id: jobId });
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
        toast.success('🎵 Siren Song track ready!');
        return;
      }
      if (data?.status === 'failed') {
        setError(data.error || 'Generation failed');
        setPhase('error');
        toast.error(data.error || 'Siren Song generation failed');
        return;
      }
      setStatusMsg(data?.progress || 'Rendering on the L4 GPU…');
    }
  }, [updateSample]);

  const generate = async () => {
    if (!tags.trim()) { toast.error('Add at least one style tag'); return; }
    if (phase === 'submitting' || phase === 'rendering') return;
    cancelledRef.current = false;
    setPhase('submitting');
    setResult(null); setError(null); setStatusMsg('');
    markRegenerated();
    try {
      const numSeed = Number(seed);
      const res = await base44.functions.invoke('generateMusicSirenSong', {
        tags,
        lyrics: lyrics || undefined,
        max_audio_length_ms: Math.round(lengthSec * 1000),
        seed: Number.isFinite(numSeed) && numSeed > 0 ? Math.round(numSeed) : undefined,
        title: title || undefined,
      });
      refreshCreditsFromResponse(res.data);
      if (res.data?.job_id) {
        setPhase('rendering');
        setStatusMsg('Siren Song accepted the job…');
        toast.success('Siren Song is composing…');
        // Opt-in telemetry — no-ops server-side without consent.
        logGeneration({
          provider: 'sirensong', model: 'HeartMuLa 3B',
          prompt: tags, lyrics, duration: lengthSec,
        });
        pollUntilDone(res.data.job_id);
      } else {
        setPhase('error');
        setError('Unexpected response from Siren Song');
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
      <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-cyan-200/90">
          <span className="font-bold text-cyan-300">Siren Song:</span> our self-hosted HeartMuLa 3B engine, running on a Hugging Face L4 GPU. This model is <span className="font-semibold">tag &amp; lyric conditioned</span> — describe the sound with comma-separated style tags, not a sentence.
        </p>
      </div>

      {/* Free assistant first — a complete draft in HeartMuLa's tag dialect at
          no cost, before the creator decides to spend on the craft engine. */}
      <SongIdeaAssistant dialect="sirensong" duration={lengthSec} disabled={isBusy}
        onApply={({ style, lyrics: l, title: t }) => {
          setTags(style);
          setLyrics(l);
          if (t && !title.trim()) setTitle(t);
        }} />

      {/* Songwriting assistance encoded into HeartMuLa's TAG dialect — the same
          243 Masters craft engine the other studios use, translated rather than
          pasted, since a prose brief in a tag channel steers almost nothing. */}
      <ModelMastersPanel dialect="sirensong" fallbackTopic={tags}
        onApply={({ style, lyrics: l, title: t }) => {
          setTags(style);
          setLyrics(l);
          if (t && !title.trim()) setTitle(t);
        }} />

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <Tag className="w-3 h-3 text-cyan-400" /> Style Tags
          <InfoTip text="Comma-separated tokens describing genre, mood, instruments — e.g. 'red,dirt,country,acoustic,male vocal'. Not a sentence." />
        </p>
        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
          placeholder="red,dirt,country,acoustic,male vocal"
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Lyrics (Optional)
          <InfoTip text="Plain text with bracketed section headers — [Verse], [Chorus], [Bridge]. Leave blank for an instrumental." />
        </p>
        <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={6}
          placeholder={'[Verse]\nWalking down a dusty road…\n\n[Chorus]\n…'}
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none font-mono" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Title (Optional)</p>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
            placeholder="Auto-named"
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Length (sec, max {MAX_LENGTH_SEC})</p>
          <input type="number" min={5} max={MAX_LENGTH_SEC} value={lengthSec}
            onChange={(e) => setLengthSec(Math.min(Math.max(Number(e.target.value) || 5, 5), MAX_LENGTH_SEC))}
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            Seed <InfoTip text="Fix a seed to reproduce the same take. Leave blank for a random result." />
          </p>
          <input type="number" min={1} value={seed} onChange={(e) => setSeed(e.target.value)}
            placeholder="Random"
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

      <Button onClick={generate} disabled={isBusy || !tags.trim()}
        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold text-base py-5 gap-2">
        <Waves className="w-5 h-5" />
        {isBusy ? (phase === 'submitting' ? 'Starting…' : 'Composing…') : 'Generate with Siren Song'}
        {!isBusy && <CostBadge cost={COST} />}
      </Button>

      <AnimatePresence>
        {isBusy && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin flex-shrink-0" />
              <p className="text-xs text-cyan-300">{statusMsg || 'Siren Song is composing your track…'}</p>
            </div>
            <div className="h-1.5 rounded-full bg-cyan-500/20 overflow-hidden">
              <motion.div className="h-full bg-cyan-500 rounded-full"
                animate={{ x: ['-100%', '250%'] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                style={{ width: '40%' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {audioUrl && phase === 'done' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-cyan-500/30 p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-cyan-400">Track Ready</span>
              <Badge variant="outline" className="text-xs">Siren Song · HeartMuLa 3B</Badge>
              <Badge variant="outline" className="text-xs">48kHz WAV</Badge>
            </div>
            {result?.cover_image_url && (
              <div className="flex items-center gap-3">
                <img src={result.cover_image_url} alt="Cover" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-border" />
                <p className="text-xs text-muted-foreground">Auto-generated cover art</p>
              </div>
            )}

            <audio controls className="w-full rounded-xl" src={audioUrl} />
            <TrainingFeedback sampleId={sampleId} modelName="Siren Song" />
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