import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle, Download, X, Film, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import CostBadge from '@/components/credits/CostBadge';
import { handleCreditError } from '@/utils/creditErrors';
import MiniMaxH3Attribution from './MiniMaxH3Attribution';
import NovaH3Controls from './NovaH3Controls';
import NovaH3ReferenceStudio from './NovaH3ReferenceStudio';
import {
  NOVA_DEFAULT_CANVAS, NOVA_DEFAULT_DURATION, NOVA_DEFAULT_PRESET,
  novaCreditCost, snapFrames, snappedSeconds,
} from '@/config/novaH3Spec';

const IDEAS = [
  { label: '🎤 Stage close-up', prompt: 'Close on a singer at a rain-slick outdoor stage, handheld drift, breath visible under a hard key light, crowd roar and a low kick under the vocal' },
  { label: '🌃 Rooftop set', prompt: 'A synth player on a city rooftop at blue hour, slow orbit around the rig, neon spill from below, warm pads and distant traffic' },
  { label: '🎬 Film-noir hook', prompt: 'A trumpet player in a smoke-filled club, single overhead lamp, slow push in, brushed drums and glassware clinking in the room' },
  { label: '🌊 Coastal cinema', prompt: 'Wide shot of waves folding over black volcanic sand at dawn, static tripod, wind and surf recorded close, faint strings rising' },
];

// Nova renders take minutes of booked GPU time — a slow poll keeps the browser
// quiet while each call reads one short window of the engine's event stream.
const POLL_MS = 5000;

export default function NovaH3Panel() {
  const [prompt, setPrompt] = useState('');
  const [preset, setPreset] = useState(NOVA_DEFAULT_PRESET);
  const [aspect, setAspect] = useState('16:9');
  const [canvas, setCanvas] = useState(NOVA_DEFAULT_CANVAS);
  const [duration, setDuration] = useState(NOVA_DEFAULT_DURATION);
  const [seed, setSeed] = useState('');
  const [enhance, setEnhance] = useState(false);

  const [refMode, setRefMode] = useState('none');
  const [firstFrame, setFirstFrame] = useState('');
  const [lastFrame, setLastFrame] = useState('');
  const [references, setReferences] = useState([]);

  const [jobId, setJobId] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cost = novaCreditCost(preset, duration, canvas);

  const stopPolling = () => { clearTimeout(timer.current); timer.current = null; };

  const poll = async (id) => {
    try {
      const res = await base44.functions.invoke('pollNovaH3Job', { job_id: id });
      const d = res.data || {};
      if (d.status === 'completed') {
        stopPolling();
        setRunning(false);
        setResult(d);
        toast.success('🎬 Nova render ready — with its own soundtrack');
        return;
      }
      if (d.status === 'failed' || d.status === 'cancelled') {
        stopPolling();
        setRunning(false);
        setError(d.error || 'Nova render failed');
        return;
      }
      timer.current = setTimeout(() => poll(id), POLL_MS);
    } catch (e) {
      // A poll that itself failed says nothing about the render — keep watching.
      timer.current = setTimeout(() => poll(id), POLL_MS);
    }
  };

  const generate = async () => {
    if (!prompt.trim()) { toast.error('Describe the shot — H3 always needs a prompt'); return; }
    setRunning(true);
    setResult(null);
    setError('');
    setJobId('');
    try {
      const res = await base44.functions.invoke('generateVideoNovaH3', {
        prompt,
        canvas, duration, preset,
        seed: seed ? Number(seed) : undefined,
        enhance_prompt: enhance,
        first_frame_url: refMode === 'keyframes' ? firstFrame || '' : '',
        last_frame_url: refMode === 'keyframes' ? lastFrame || '' : '',
        references: refMode === 'omni' ? references.map(r => r.url).filter(Boolean) : [],
      });
      const id = res.data?.job_id;
      if (!id) { setRunning(false); toast.error('Nova did not start'); return; }
      setJobId(id);
      toast.success('Booked a GPU worker — rendering picture and sound together…');
      timer.current = setTimeout(() => poll(id), POLL_MS);
    } catch (err) {
      setRunning(false);
      if (!handleCreditError(err)) {
        setError(err?.response?.data?.error || err?.response?.data?.message || err.message);
      }
    }
  };

  const cancel = async () => {
    stopPolling();
    if (jobId) {
      try {
        await base44.entities.GenerationJob.update(jobId, {
          status: 'cancelled', completed_at: new Date().toISOString(),
        });
      } catch { /* best effort — credits are only charged on completion */ }
    }
    setJobId('');
    setRunning(false);
    toast.info('Stopped watching — no credits charged');
  };

  return (
    <div className="space-y-6">
      <MiniMaxH3Attribution />

      {/* Shot ideas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {IDEAS.map(i => (
          <button key={i.label} type="button" onClick={() => setPrompt(i.prompt)}
            className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${prompt === i.prompt ? 'border-indigo-500 bg-indigo-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-indigo-500/40'}`}>
            {i.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <NovaH3Controls
            preset={preset} setPreset={setPreset}
            aspect={aspect} setAspect={setAspect}
            canvas={canvas} setCanvas={setCanvas}
            duration={duration} setDuration={setDuration}
            seed={seed} setSeed={setSeed}
            enhance={enhance} setEnhance={setEnhance}
          />
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Shot description</p>
            <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={5} className="rounded-xl"
              placeholder="Describe the scene — the action, the camera, the mood, and the sound. H3 generates the soundtrack from this too, so name what you want to hear." />
            <p className="text-xs text-muted-foreground mt-1">
              Say what the microphone hears as well as what the lens sees — room tone, crowd, instrument close-ups.
            </p>
          </div>

          <NovaH3ReferenceStudio
            refMode={refMode} setRefMode={setRefMode}
            firstFrame={firstFrame} setFirstFrame={setFirstFrame}
            lastFrame={lastFrame} setLastFrame={setLastFrame}
            references={references} setReferences={setReferences}
          />

          <Button onClick={generate} disabled={running || !prompt.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-base py-5 gap-2">
            <Zap className="w-5 h-5" />
            {running ? 'Rendering on Nova…' : 'Generate with Nova'}
            {!running && <CostBadge cost={cost} />}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            {snappedSeconds(duration).toFixed(3)}s · {snapFrames(duration)} frames · {canvas} · picture and stereo audio in one pass
          </p>

          <AnimatePresence>
            {running && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-xs text-indigo-200">
                    Nova has a GPU worker booked. Longer clips, larger canvases and the Exact schedule all book more
                    time — a few minutes is normal.
                  </p>
                </div>
                <Button onClick={cancel} variant="outline" size="sm"
                  className="w-full gap-1.5 rounded-lg border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/10">
                  <X className="w-3.5 h-3.5" /> Stop watching — no credits charged
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">{error}</div>
          )}

          <AnimatePresence>
            {result?.video_url && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">Nova render ready</span>
                  <MiniMaxH3Attribution variant="badge" />
                  <Badge variant="outline" className="text-xs">{result.canvas}</Badge>
                  <Badge variant="outline" className="text-xs">{Number(result.duration || 0).toFixed(2)}s</Badge>
                  <Badge variant="outline" className="text-xs gap-1"><Music2 className="w-3 h-3" /> native stereo</Badge>
                </div>
                <video controls className="w-full rounded-xl" src={result.video_url} />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Film className="w-3 h-3" /> Saved to your library — available to Live Studio venue programmes,
                  the timeline editor and the music-video composer.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <a href={result.video_url} download className="flex-1">
                    <Button variant="outline" className="w-full gap-2 rounded-xl">
                      <Download className="w-4 h-4" /> Download MP4
                    </Button>
                  </a>
                  <Button variant="outline" onClick={() => setResult(null)} className="rounded-xl">New shot</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}