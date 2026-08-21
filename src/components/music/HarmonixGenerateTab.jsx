import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Sparkles, ShieldCheck, Zap, CheckCircle, Download, Save, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useJobPolling } from '@/hooks/useJobPolling';
import CostBadge from '@/components/credits/CostBadge';
import InfoTip from '@/components/common/InfoTip';
import { handleCreditError, refreshCreditsFromResponse, getProviderErrorMessage } from '@/utils/creditErrors';
import { calculateHumanParticipationScore } from '@/utils/participationScore';
import HarmonixMastersPanel from '@/components/songwriting/HarmonixMastersPanel';
import TrainingFeedback from '@/components/training/TrainingFeedback';
import { useTrainingTelemetry } from '@/hooks/useTrainingTelemetry';

const TIERS = [
  { key: 'micro', name: 'Micro', tagline: 'Lite / Fast', icon: Zap, cost: 3, color: 'border-cyan-500 bg-cyan-500/10 text-cyan-300', desc: 'Quick draft generation & real-time previewing' },
  { key: 'pro', name: 'Pro', tagline: 'Core Model · v1', icon: Sparkles, cost: 10, color: 'border-blue-500 bg-blue-500/10 text-blue-300', desc: 'Full-track generation for the standard pipeline' },
  { key: 'vault', name: 'Vault', tagline: 'Watermarked / Verified · COS', icon: ShieldCheck, cost: 15, color: 'border-amber-500 bg-amber-500/10 text-amber-300', desc: 'Pro quality + acoustic watermarking & DDEX metadata' },
];

export default function HarmonixGenerateTab() {
  const [tier, setTier] = useState('pro');
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [markStatus, setMarkStatus] = useState(null); // null | 'queued'
  const [savedAssetId, setSavedAssetId] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [usedMasters, setUsedMasters] = useState(false);
  const { sampleId, logGeneration, markRegenerated } = useTrainingTelemetry();
  const savedRef = useRef(false);
  const tierRef = useRef('pro');

  const tierConfig = TIERS.find(t => t.key === tier);

  const saveToLibrary = useCallback(async (audioUrl, data, coverImageUrl = null) => {
    if (!audioUrl || savedRef.current) return;
    savedRef.current = true;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const usedTier = tierRef.current;
      const participation = await calculateHumanParticipationScore({
        userProvidedContent: !!lyrics.trim(),
        prompt,
        styleOrTags: [],
        personaOrTemplate: false,
        isIteration: false,
      });

      const asset = await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: title.trim() || prompt.slice(0, 40) || 'Harmonix Track',
        file_url: audioUrl,
        thumbnail_url: coverImageUrl || '',
        is_public: false,
        ai_label: participation.label,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
        ddex_ai_metadata: participation.ddex,
        metadata: {
          provider: 'harmonix',
          tier: usedTier,
          model: 'ACE-Step v1.5',
          prompt,
          lyrics: lyrics || '',
          duration: data?.duration || duration,
          content_hash: data?.content_hash || '',
          ai_assisted: true,
        },
      });
      setSavedAssetId(asset.id);
      toast.success('✅ Saved to library!');

      // Vault tier — fire the neural BASE Mark watermark embed in the background.
      if (usedTier === 'vault') {
        setMarkStatus('queued');
        base44.functions.invoke('embedBaseMarkV2', { assetId: asset.id }).catch(() => {});
      }
    } catch (err) {
      savedRef.current = false;
      toast.error(`Save failed: ${err.message}`);
    }
    setSaving(false);
  }, [prompt, lyrics, title, duration]);

  // Cover art — generated once per track, then attached to the saved asset.
  const generateCover = useCallback(async () => {
    setGeneratingCover(true);
    try {
      const res = await base44.integrations.Core.GenerateImage({
        prompt: `Music album cover artwork. Theme: ${prompt.slice(0, 300)}. Bold composition, dramatic lighting, professional music industry aesthetic. No text overlays.`,
      });
      setCoverUrl(res.url || null);
      return res.url || null;
    } catch {
      return null;
    } finally {
      setGeneratingCover(false);
    }
  }, [prompt]);

  // Opt-in telemetry — no-ops server-side when the user hasn't consented.
  const logSample = useCallback(() => logGeneration({
    provider: 'harmonix',
    model: tierRef.current,
    prompt,
    lyrics,
    duration,
    used_masters_engine: usedMasters,
  }), [prompt, lyrics, duration, usedMasters, logGeneration]);

  const onComplete = useCallback(async (data) => {
    setGenerating(false);
    setResult(data);
    toast.success('🎵 Track ready!');
    const audioUrl = data.audio_url || data.output_url;
    const cover = await generateCover();
    await saveToLibrary(audioUrl, data, cover);
    logSample();
  }, [saveToLibrary, generateCover, logSample]);

  const onError = useCallback((msg) => {
    setGenerating(false);
    setLastError({ message: msg || 'Generation failed' });
    toast.error(msg || 'Generation failed');
  }, []);

  const { status, progress } = useJobPolling(jobId, onComplete, onError);
  const isProcessing = generating || (jobId && (status === 'processing' || status === 'pending'));

  const generate = async () => {
    if (!prompt.trim()) { toast.error('Describe the track you want BASE-Harmonix to make'); return; }
    if (isProcessing) return;
    setGenerating(true);
    setResult(null);
    setJobId('');
    setLastError(null);
    setMarkStatus(null);
    setSavedAssetId(null);
    setCoverUrl(null);
    savedRef.current = false;
    tierRef.current = tier;
    markRegenerated();

    try {
      const res = await base44.functions.invoke('generateMusicHarmonix', {
        tier, prompt, lyrics: lyrics || undefined, duration, title: title || undefined,
      });
      refreshCreditsFromResponse(res.data);

      if (res.data?.audio_url) {
        setGenerating(false);
        setResult(res.data);
        toast.success('🎵 Track ready!');
        const cover = await generateCover();
        await saveToLibrary(res.data.audio_url, res.data, cover);
        logSample();
      } else if (res.data?.job_id) {
        setJobId(res.data.job_id);
        toast.success('BASE-Harmonix is composing…');
      } else {
        setGenerating(false);
        toast.error('Unexpected response from BASE-Harmonix');
      }
    } catch (err) {
      setGenerating(false);
      const data = err?.response?.data;
      const isCredits = data?.error === 'Insufficient credits';
      const friendly = getProviderErrorMessage(err);
      const msg = friendly || data?.message || err.message || 'Generation failed';
      setLastError({ message: msg, isCredits, required: data?.required, balance: data?.balance });
      if (!handleCreditError(err)) toast.error(msg);
    }
  };

  const audioUrl = result?.audio_url || result?.output_url;

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-200/90">
          <span className="font-bold text-emerald-300">BASE-Harmonix:</span> our in-house studio built on ACE-Step v1.5, an open-source foundation model — generates full instrumental or vocal tracks from a single prompt. Pick a tier below.
        </p>
      </div>

      {/* Tier picker */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Model Tier</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TIERS.map(t => (
            <button key={t.key} onClick={() => setTier(t.key)}
              className={`text-left p-3 rounded-xl border transition-all ${tier === t.key ? t.color : 'border-border bg-card text-muted-foreground hover:border-border/80'}`}>
              <div className="flex items-center gap-1.5 font-bold text-sm mb-0.5">
                <t.icon className="w-4 h-4" /> BASE-Harmonix {t.name}
              </div>
              <div className="text-[11px] opacity-80 mb-1">{t.tagline}</div>
              <div className="text-xs opacity-70">{t.desc}</div>
              <div className="mt-1.5 text-xs font-semibold">{t.cost} credits</div>
            </button>
          ))}
        </div>
        {tier === 'vault' && (
          <p className="text-xs text-amber-300 mt-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Vault tracks are automatically queued for BASE Mark neural watermarking after generation.
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-yellow-400" /> Describe Your Track
          <InfoTip text="Describe instruments, mood, and atmosphere — e.g. '808 sub bass, brushed snare, dreamy synth pads, late-night atmosphere'." />
        </p>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
          placeholder="e.g. Uplifting synth-pop with bright plucks, punchy drums and a soaring chorus…"
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
      </div>

      <HarmonixMastersPanel fallbackTopic={prompt} onApply={({ lyrics: l, prompt: p, title: t }) => {
        setLyrics(l);
        setPrompt(p);
        setUsedMasters(true);
        if (t && !title.trim()) setTitle(t);
      }} />

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Lyrics (Optional)
          <InfoTip text="Leave blank for an instrumental track. Add lyrics to generate a full vocal song." />
        </p>
        <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={3}
          placeholder="Leave blank for instrumental, or paste your lyrics here…"
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Title (Optional)</p>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
            placeholder="Leave blank to auto-name"
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Duration (sec, max {tierConfig.key === 'micro' ? 30 : tierConfig.key === 'pro' ? 120 : 180})</p>
          <input type="number" min={5} max={tierConfig.key === 'micro' ? 30 : tierConfig.key === 'pro' ? 120 : 180} value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
      </div>

      <AnimatePresence>
        {lastError && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className={`p-4 rounded-xl border flex items-start gap-3 ${lastError.isCredits ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${lastError.isCredits ? 'text-amber-400' : 'text-red-400'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold mb-0.5 ${lastError.isCredits ? 'text-amber-300' : 'text-red-300'}`}>
                {lastError.isCredits ? 'Out of Credits' : 'Generation Failed'}
              </p>
              <p className="text-xs text-muted-foreground">{lastError.message}</p>
              <Button size="sm" variant="ghost" onClick={() => setLastError(null)} className="rounded-lg text-xs mt-2">Dismiss</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button onClick={generate} disabled={isProcessing || !prompt.trim()}
        className="w-full bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 rounded-xl font-bold text-base py-5 gap-2">
        <Sparkles className="w-5 h-5" />
        {isProcessing ? (jobId ? `Composing… ${progress}%` : 'Starting…') : `⚡ Generate with ${tierConfig.name}`}
        {!isProcessing && <CostBadge cost={tierConfig.cost} />}
      </Button>

      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
              <p className="text-xs text-blue-300">BASE-Harmonix {tierConfig.name} is composing your track…</p>
            </div>
            <div className="h-1.5 rounded-full bg-blue-500/20 overflow-hidden">
              <motion.div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress || 10}%` }} animate={{ width: `${progress || 10}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {audioUrl && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">Track Ready</span>
              <Badge variant="outline" className="text-xs">{tierConfig.name}</Badge>
              {markStatus === 'queued' && (
                <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Watermarking queued
                </Badge>
              )}
            </div>
            {/* Cover art — auto-generated once per track */}
            <div className="flex items-center gap-3">
              {generatingCover ? (
                <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                  <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-border" />
              ) : null}
              {(generatingCover || coverUrl) && (
                <p className="text-xs text-muted-foreground">
                  {generatingCover ? 'Generating cover art…' : 'Auto-generated cover art'}
                </p>
              )}
            </div>

            <audio controls className="w-full rounded-xl" src={audioUrl} />
            <TrainingFeedback sampleId={sampleId} onOptIn={logSample} />
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => saveToLibrary(audioUrl, result, coverUrl)} disabled={saving || !!savedAssetId}
                className="flex-1 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold disabled:opacity-60">
                <Save className="w-4 h-4" /> {saving ? 'Saving…' : savedAssetId ? 'Saved to Library' : 'Save to Library'}
              </Button>
              <a href={audioUrl} download className="flex-1">
                <Button variant="outline" className="w-full gap-2 rounded-xl">
                  <Download className="w-4 h-4" /> Download
                </Button>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}