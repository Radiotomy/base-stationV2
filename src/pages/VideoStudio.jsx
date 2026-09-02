import { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film, Zap, Download, ArrowLeft, Save, RotateCcw,
  CheckCircle, Sparkles, Clock, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useJobPolling } from '@/hooks/useJobPolling';
import { handleCreditError, refreshCreditsFromResponse } from '@/utils/creditErrors';
import CostBadge from '@/components/credits/CostBadge';
import InfoTip from '@/components/common/InfoTip';
import MusicVideoComposer from '@/components/video/MusicVideoComposer';
import TimelineEditorTab from '@/components/video/TimelineEditorTab';
import LtxControls from '@/components/video/LtxControls';
import ReferenceMediaInput from '@/components/video/ReferenceMediaInput';
import { calculateHumanParticipationScore } from '@/utils/participationScore';
import { getModelSpec, durationsFor, maxAudioSeconds, creditCost } from '@/config/ltxModelSpec';

const PROMPT_TEMPLATES = [
  { label: '🌌 Cosmic Journey',  prompt: 'A journey through a neon-lit cosmos, vibrant nebulae swirling, stars exploding in slow motion, cinematic' },
  { label: '🏙️ Night City',      prompt: 'Rain-soaked city streets at night, neon reflections, empty alleyways, cyberpunk atmosphere, moody' },
  { label: '🌊 Ocean Waves',     prompt: 'Powerful ocean waves crashing on rocky cliffs at sunset, warm golden light, slow motion foam' },
  { label: '🔥 Abstract Fire',   prompt: 'Abstract fire and embers floating upward in slow motion, deep black background, cinematic 4K' },
  { label: '🌸 Dream Forest',    prompt: 'Ethereal forest at golden hour, light rays through trees, floating particles, dreamy atmosphere' },
  { label: '⚡ Energy Pulse',    prompt: 'Electric energy pulses and lightning bolts in a dark void, neon blues and purples, abstract' },
  { label: '🎵 Music Visualizer', prompt: 'Sound waves morphing into colorful geometric shapes, pulsing to a beat, dark background, vibrant colors' },
  { label: '🏔️ Mountain Timelapse', prompt: 'Mountain peaks at sunrise, clouds rolling in fast, warm amber sky, epic landscape timelapse' },
];

const STYLE_CHIPS = ['Cinematic', 'Dreamlike', 'Dark & Moody', 'Vibrant', 'Abstract', 'Realistic', 'Vintage', 'Futuristic'];
const MODES = [
  { id: 'text', label: '✍️ Text to Video', desc: 'Generate from a text prompt' },
  { id: 'image', label: '🖼️ Image to Video', desc: 'Animate an image — upload, library or URL' },
  { id: 'audio', label: '🎵 Audio to Video', desc: 'Visual synced to any track you own' },
  { id: 'musicvideo', label: '🎬 Music Video', desc: 'Stock or your own clips + audio' },
  { id: 'timeline', label: '🎚️ Timeline Editor', desc: 'Drag & drop — library, uploads, URLs' },
];

export default function VideoStudio() {
  const [mode, setMode] = useState('text');
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(8);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [model, setModel] = useState('ltx-2-5-fast');
  const [resolutionTier, setResolutionTier] = useState('1080p');
  const [fps, setFps] = useState(24);
  const [cameraMotion, setCameraMotion] = useState('');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [style, setStyle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState([]);
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [referenceAudioUrl, setReferenceAudioUrl] = useState('');
  const [lastFrameUrl, setLastFrameUrl] = useState('');

  // Load recent video versions from the user's library so history survives refresh
  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        const rows = await base44.entities.UserAsset.filter(
          { user_id: me.id, asset_type: 'project' }, '-created_date', 10
        );
        const videos = rows
          .filter(a => a.file_url && /\.(mp4|mov|webm)(\?|$)/i.test(a.file_url))
          .slice(0, 5)
          .map(a => ({
            video_url: a.file_url,
            title: a.title,
            ...(a.metadata || {}),
          }));
        if (videos.length > 0) setVersions(videos);
      } catch { /* silent — fresh users have no history */ }
    })();
  }, []);

  const onComplete = useCallback((data) => {
    setGenerating(false);
    setResult(data);
    if (data?.video_url) setVersions(v => [data, ...v].slice(0, 5));
    toast.success('🎬 Video ready!');
  }, []);

  const onError = useCallback((msg) => {
    setGenerating(false);
    toast.error(msg || 'Generation failed');
  }, []);

  const { status, progress } = useJobPolling(jobId, onComplete, onError);
  const isProcessing = generating || (jobId && status === 'processing');

  const cancelGeneration = useCallback(async () => {
    // Mark the job cancelled server-side so analytics are accurate, then
    // detach the polling loop locally. Credits are only deducted on completion,
    // so no refund is needed.
    if (jobId) {
      try {
        await base44.entities.GenerationJob.update(jobId, {
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        });
      } catch { /* best-effort */ }
    }
    setJobId('');
    setGenerating(false);
    toast.info('Generation cancelled');
  }, [jobId]);

  const generate = async () => {
    if (!prompt && mode === 'text') { toast.error('Enter a prompt'); return; }
    if (mode === 'image' && !referenceImageUrl) { toast.error('Upload a reference image'); return; }
    if (mode === 'audio' && !referenceAudioUrl) { toast.error('Upload a reference audio track'); return; }
    setGenerating(true);
    setResult(null);
    setJobId('');
    try {
      const fullPrompt = style ? `${prompt}, ${style} style` : prompt;
      const res = await base44.functions.invoke('generateVideoLTX', {
        prompt: fullPrompt || 'cinematic music visualizer',
        duration,
        aspect_ratio: aspectRatio,
        mode,
        model,
        resolution_tier: resolutionTier,
        fps,
        camera_motion: cameraMotion,
        generate_audio: generateAudio,
        reference_image_url: mode === 'image' || mode === 'audio' ? referenceImageUrl || undefined : undefined,
        reference_audio_url: mode === 'audio' ? referenceAudioUrl : undefined,
        last_frame_url: mode === 'image' && duration !== null ? lastFrameUrl || undefined : undefined,
      });
      if (res.data?.video_url) {
        setResult(res.data);
        setVersions(v => [res.data, ...v].slice(0, 5));
        setGenerating(false);
        refreshCreditsFromResponse(res.data);
        toast.success('🎬 Video ready!');
      } else if (res.data?.job_id) {
        setJobId(res.data.job_id);
        toast.success('Video generation started — polling for result…');
      } else {
        setGenerating(false);
        toast.error('No job ID returned');
      }
    } catch (err) {
      setGenerating(false);
      if (!handleCreditError(err)) toast.error(err?.response?.data?.message || err.message);
    }
  };

  const saveToLibrary = async () => {
    if (!result?.video_url) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const participation = calculateHumanParticipationScore({
        userProvidedContent: false,
        prompt,
        styleOrTags: style ? [style] : [],
        referenceFile: !!(referenceImageUrl || referenceAudioUrl),
        personaOrTemplate: PROMPT_TEMPLATES.some(t => t.prompt === prompt),
        isIteration: versions.length > 1,
      });
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'project',
        title: prompt.slice(0, 60) + (prompt.length > 60 ? '…' : ''),
        file_url: result.video_url,
        is_public: false,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
        metadata: { prompt, duration, aspectRatio, style, provider: 'ltx', model, resolution_tier: resolutionTier, fps, camera_motion: cameraMotion, generate_audio: generateAudio },
      });
      toast.success('Saved to library!');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  // Each model supports its own resolutions, frame rates and lengths — keep the
  // selection inside what the API will accept whenever the model or mode changes.
  useEffect(() => {
    const spec = getModelSpec(model);
    if (!spec.modes.includes(mode) && (mode === 'text' || mode === 'image' || mode === 'audio')) {
      setModel('ltx-2-5-fast');
      return;
    }
    if (!spec.tiers.includes(resolutionTier)) setResolutionTier('1080p');
    if (!spec.fps.includes(fps)) setFps(24);
    setDuration(d => {
      if (d === null) return spec.autoDuration ? null : durationsFor(model, resolutionTier, fps).slice(-1)[0];
      const allowed = durationsFor(model, resolutionTier, fps);
      return allowed.includes(d) ? d : allowed[allowed.length - 1];
    });
  }, [model, mode, resolutionTier, fps]);

  // Auto duration and audio-driven clips are billed against the model's max length
  const autoMax = durationsFor(model, resolutionTier, fps).slice(-1)[0];
  const billedSeconds = mode === 'audio'
    ? maxAudioSeconds(model, resolutionTier)
    : (duration === null ? autoMax : duration);
  const cost = creditCost(model, resolutionTier, billedSeconds);
  const estimatedSeconds = billedSeconds * 12; // rough estimate: ~12s processing per second of video

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> ~{Math.ceil(estimatedSeconds / 60)}min ETA
        </span>
      </div>

      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-indigo-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎬 Video Studio</h1>
          <p className="text-white/60 text-base md:text-lg">Generate cinematic AI videos, cut multi-scene music videos, or edit on a timeline — using stock footage, your library, or your own uploads.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">

        {/* Mode Switcher */}
        <div className="flex gap-2 flex-wrap">
          {MODES.map(m => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)}
              className={`flex-1 min-w-[140px] p-3 rounded-xl border text-left transition-all ${mode === m.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card hover:border-indigo-500/40'}`}>
              <p className="text-sm font-bold text-foreground">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Music Video Mode (Shotstack multi-scene composer) */}
        {mode === 'musicvideo' && <MusicVideoComposer />}

        {/* Drag-and-drop timeline editor (Shotstack Studio SDK) */}
        {mode === 'timeline' && <TimelineEditorTab />}

        {/* Reference media (upload / library / URL) for Image & Audio modes */}
        {mode === 'image' && (
          <>
            <ReferenceMediaInput kind="image" value={referenceImageUrl} onChange={setReferenceImageUrl} />
            {duration !== null && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  Last Frame — optional
                  <InfoTip text="Give LTX an end frame and it interpolates from your first image to this one. Needs a fixed duration, so it can't be combined with Auto." />
                </p>
                <ReferenceMediaInput kind="image" value={lastFrameUrl} onChange={setLastFrameUrl} />
              </div>
            )}
          </>
        )}

        {mode === 'audio' && (
          <>
            <ReferenceMediaInput kind="audio" value={referenceAudioUrl} onChange={setReferenceAudioUrl} />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                Reference Image — optional
                <InfoTip text="Optional first frame that steers the look of the audio-driven video. Without one, your prompt alone describes the visuals." />
              </p>
              <ReferenceMediaInput kind="image" value={referenceImageUrl} onChange={setReferenceImageUrl} />
            </div>
          </>
        )}

        {/* LTX Mode UI (text / image / audio) */}
        {mode !== 'musicvideo' && mode !== 'timeline' && <>

        {/* Text mode renders on our own engine first — the controls below only
            apply when that engine is unavailable and the LTX cloud takes over. */}
        {mode === 'text' && (
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-muted-foreground">
            <span className="font-bold text-emerald-300">BASE Station LTX Engine</span> — text prompts render on our own self-hosted model first: 768×512, ~4 s, silent, seed-reproducible, <span className="font-bold text-foreground">6 credits flat</span>. If our engine is asleep or busy, the request falls back to the LTX cloud, where the model, resolution, duration and soundtrack settings below apply and the per-second price shown on the button is charged.
          </div>
        )}

        {/* Prompt Templates */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Prompt Templates</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {PROMPT_TEMPLATES.map(t => (
              <button key={t.label} type="button" onClick={() => setPrompt(t.prompt)}
                className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${prompt === t.prompt ? 'border-indigo-500 bg-indigo-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-indigo-500/40'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Controls */}
          <div className="lg:col-span-1 space-y-5">

            <LtxControls
              model={model} setModel={setModel}
              aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
              resolutionTier={resolutionTier} setResolutionTier={setResolutionTier}
              duration={duration} setDuration={setDuration}
              fps={fps} setFps={setFps}
              cameraMotion={cameraMotion} setCameraMotion={setCameraMotion}
              generateAudio={generateAudio} setGenerateAudio={setGenerateAudio}
              mode={mode}
            />

            {/* Style Chips */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                Visual Style
                <InfoTip text="Optional style modifier appended to your prompt. Cinematic & Dreamlike are the safest defaults; Abstract for music visualizers." />
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_CHIPS.map(s => (
                  <button key={s} type="button" onClick={() => setStyle(style === s ? '' : s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${style === s ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Version History */}
            {versions.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Previous Versions</p>
                {versions.slice(1).map((v, i) => (
                  <button key={i} type="button" onClick={() => setResult(v)}
                    className="w-full text-left p-2 rounded-xl bg-muted text-xs text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-300 transition-all">
                    Version {versions.length - 1 - i}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Prompt + Output */}
          <div className="lg:col-span-2 space-y-5">

            {/* Prompt */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                Video Prompt
                <InfoTip text="Describe motion + lighting + atmosphere, not just objects. 'Slow zoom through neon city rain at 3 AM' beats 'city at night'." />
              </p>
              <Textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder="Describe your video in detail — setting, mood, movement, colors, atmosphere…"
                rows={4} className="rounded-xl" />
              <p className="text-xs text-muted-foreground mt-1">Tip: Be specific about motion, lighting, and atmosphere for best results.</p>
            </div>

            <Button onClick={generate} disabled={isProcessing || (!prompt && !(mode === 'audio' && referenceImageUrl))}
              className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-base py-5 gap-2">
              <Zap className="w-5 h-5" />
              {isProcessing ? `Generating… ${progress || 0}%` : 'Generate Video'}
              {!isProcessing && <CostBadge cost={cost} />}
            </Button>

            {/* Progress */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-indigo-500/20 overflow-hidden">
                        <motion.div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress || 5}%` }} animate={{ width: `${progress || 5}%` }} />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-indigo-300">LTX is rendering your video — typically takes {Math.ceil(estimatedSeconds / 60)}–{Math.ceil(estimatedSeconds / 60) + 2} minutes…</p>
                  <Button
                    onClick={cancelGeneration}
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 rounded-lg border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/10"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel — no credits charged
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result */}
            <AnimatePresence>
              {result?.video_url && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">Video Ready</span>
                    {result.engine === 'hf_private' ? (
                      <>
                        <Badge variant="outline" className="text-xs">BASE Station engine</Badge>
                        <Badge variant="outline" className="text-xs">{result.resolution} · {result.duration}s · silent</Badge>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-xs">{aspectRatio}</Badge>
                        <Badge variant="outline" className="text-xs">{duration === null ? 'Auto' : `${duration}s`}</Badge>
                      </>
                    )}
                  </div>
                  <video controls className="w-full rounded-xl" src={result.video_url} />
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={saveToLibrary} disabled={saving}
                      className="flex-1 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold">
                      <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save to Library'}
                    </Button>
                    <a href={result.video_url} download className="flex-1">
                      <Button variant="outline" className="w-full gap-2 rounded-xl">
                        <Download className="w-4 h-4" /> Download
                      </Button>
                    </a>
                    <Button variant="outline" onClick={() => setResult(null)} className="gap-2 rounded-xl">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        </>}
        {/* end LTX mode UI */}
      </div>
    </div>
  );
}