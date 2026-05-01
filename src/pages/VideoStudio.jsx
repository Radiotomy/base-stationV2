import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film, Zap, Download, ArrowLeft, Save, RotateCcw,
  CheckCircle, Sparkles, Clock, Image
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useJobPolling } from '@/hooks/useJobPolling';

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', desc: 'Landscape / YouTube' },
  { value: '9:16', label: '9:16', desc: 'Portrait / Reels' },
  { value: '1:1',  label: '1:1',  desc: 'Square / Instagram' },
  { value: '4:3',  label: '4:3',  desc: 'Classic' },
];

const DURATIONS = [3, 5, 8, 10, 15, 20, 30];

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

export default function VideoStudio() {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [style, setStyle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState([]);

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

  const generate = async () => {
    if (!prompt) { toast.error('Enter a prompt'); return; }
    setGenerating(true);
    setResult(null);
    setJobId('');
    try {
      const fullPrompt = style ? `${prompt}, ${style} style` : prompt;
      const res = await base44.functions.invoke('generateVideoLTX', {
        prompt: fullPrompt,
        duration,
        aspect_ratio: aspectRatio,
      });
      if (res.data?.video_url) {
        setResult(res.data);
        setVersions(v => [res.data, ...v].slice(0, 5));
        setGenerating(false);
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
      toast.error(err.message);
    }
  };

  const saveToLibrary = async () => {
    if (!result?.video_url) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'project',
        title: prompt.slice(0, 60) + (prompt.length > 60 ? '…' : ''),
        file_url: result.video_url,
        is_public: false,
        metadata: { prompt, duration, aspectRatio, style, provider: 'ltx' },
      });
      toast.success('Saved to library!');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const estimatedSeconds = duration * 12; // rough estimate: ~12s processing per second of video

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
          <p className="text-white/60 text-lg">Generate cinematic AI videos with LTX — music visualizers, promos & more.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">

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

            {/* Aspect Ratio */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Aspect Ratio</p>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map(ar => (
                  <button key={ar.value} type="button" onClick={() => setAspectRatio(ar.value)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${aspectRatio === ar.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card hover:border-indigo-500/40'}`}>
                    <p className="text-sm font-bold text-foreground">{ar.label}</p>
                    <p className="text-xs text-muted-foreground">{ar.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Duration: <span className="text-foreground">{duration}s</span></p>
              <div className="flex flex-wrap gap-1.5">
                {DURATIONS.map(d => (
                  <button key={d} type="button" onClick={() => setDuration(d)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${duration === d ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* Style Chips */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Visual Style</p>
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
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Video Prompt</p>
              <Textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder="Describe your video in detail — setting, mood, movement, colors, atmosphere…"
                rows={4} className="rounded-xl" />
              <p className="text-xs text-muted-foreground mt-1">Tip: Be specific about motion, lighting, and atmosphere for best results.</p>
            </div>

            <Button onClick={generate} disabled={isProcessing || !prompt}
              className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-base py-5 gap-2">
              <Zap className="w-5 h-5" />
              {isProcessing ? `Generating… ${progress || 0}%` : 'Generate Video'}
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
                    <Badge variant="outline" className="text-xs">{aspectRatio}</Badge>
                    <Badge variant="outline" className="text-xs">{duration}s</Badge>
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
      </div>
    </div>
  );
}