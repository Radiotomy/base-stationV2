import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, AlertCircle, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import CostBadge from '@/components/credits/CostBadge';
import { handleCreditError, refreshCreditsFromResponse } from '@/utils/creditErrors';
import SfxResultCard from '@/components/sfx/SfxResultCard';
import SfxLibraryList from '@/components/sfx/SfxLibraryList';

const SFX_COST = 3;

const TEMPLATES = [
  { label: '🌧️ Rain on Window', prompt: 'Gentle rain tapping on a window pane, distant thunder rumble, cozy interior ambience' },
  { label: '💥 Cinematic Braam', prompt: 'Massive cinematic braam hit, deep brass impact with long dark reverb tail, trailer-style' },
  { label: '💨 Whoosh Transition', prompt: 'Fast airy whoosh transition sweep, rising pitch, clean production-ready' },
  { label: '📀 Vinyl Crackle', prompt: 'Warm vinyl crackle and dust noise, steady loop, lo-fi texture layer' },
  { label: '🎉 Crowd Cheering', prompt: 'Large concert crowd cheering and applauding, stadium energy, distant whistles' },
  { label: '🚀 808 Riser', prompt: 'Tense synth riser building over several seconds into a hard 808 sub drop impact' },
];

export default function SoundFXStudio() {
  const [prompt, setPrompt] = useState('');
  const [autoDuration, setAutoDuration] = useState(true);
  const [duration, setDuration] = useState(5);
  const [loop, setLoop] = useState(false);
  const [influence, setInfluence] = useState(0.3);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [library, setLibrary] = useState([]);

  const loadLibrary = () => {
    base44.auth.me().then(user =>
      base44.entities.UserAsset.filter({ user_id: user.id, asset_type: 'sfx' }, '-created_date', 12)
        .then(setLibrary)
        .catch(() => {})
    ).catch(() => {});
  };
  useEffect(loadLibrary, []);

  const generate = async () => {
    if (!prompt.trim()) { toast.error('Describe the sound effect first'); return; }
    if (generating) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('generateSoundEffect', {
        text: prompt,
        loop,
        prompt_influence: influence,
        ...(!autoDuration && { duration_seconds: duration }),
      });
      if (res.data?.audio_url) {
        setResult({ audioUrl: res.data.audio_url, prompt, params: { duration_seconds: autoDuration ? null : duration, loop, prompt_influence: influence } });
        refreshCreditsFromResponse(res.data);
        toast.success('💥 Sound effect ready!');
      } else {
        toast.error('Unexpected response from ElevenLabs');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message;
      if (!handleCreditError(err)) toast.error(msg || 'Generation failed');
    }
    setGenerating(false);
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground mb-2 tracking-tight">💥 Sound FX Studio</h1>
          <p className="text-muted-foreground text-sm">
            Turn text into production-ready sound effects with ElevenLabs — risers, impacts, ambiences, loops and textures for your tracks and videos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Prompt */}
            <div className={`p-4 rounded-2xl border-2 transition-colors ${prompt.trim() ? 'border-violet-500/40 bg-violet-500/5' : 'border-amber-500/50 bg-amber-500/5'}`}>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <p className="text-xs font-black text-foreground uppercase">Describe the Sound</p>
                {!prompt.trim() && (
                  <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Required
                  </span>
                )}
              </div>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
                placeholder="e.g. Deep cinematic impact with a long reverb tail and sub-bass rumble…"
                className="w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
              <div className="flex gap-1.5 overflow-x-auto pb-1 mt-2" style={{ scrollbarWidth: 'thin' }}>
                {TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => setPrompt(t.prompt)}
                    className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${prompt === t.prompt ? 'border-violet-500 bg-violet-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-violet-500/40 hover:text-foreground'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="p-4 rounded-2xl border border-border bg-card space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Duration: <span className="text-foreground">{autoDuration ? 'Auto' : `${duration}s`}</span>
                  </p>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Switch checked={autoDuration} onCheckedChange={setAutoDuration} /> Auto
                  </label>
                </div>
                {!autoDuration && (
                  <Slider value={[duration]} onValueChange={([v]) => setDuration(v)} min={0.5} max={30} step={0.5} />
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Prompt Influence: <span className="text-foreground">{Math.round(influence * 100)}%</span>
                </p>
                <Slider value={[influence]} onValueChange={([v]) => setInfluence(v)} min={0} max={1} step={0.05} />
                <p className="text-[10px] text-muted-foreground mt-1">Higher = follows your text more literally; lower = more creative variation.</p>
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5" /> Seamless Loop
                </span>
                <Switch checked={loop} onCheckedChange={setLoop} />
              </label>
            </div>

            <Button onClick={generate} disabled={generating || !prompt.trim()}
              className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl font-bold text-base py-5 gap-2">
              <Zap className="w-5 h-5" />
              {generating ? 'Generating…' : '💥 Generate Sound FX'}
              {!generating && <CostBadge cost={SFX_COST} />}
            </Button>

            <AnimatePresence>
              {generating && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin flex-shrink-0" />
                  <p className="text-xs text-violet-300">ElevenLabs is crafting your sound effect — usually under 15 seconds…</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <SfxResultCard audioUrl={result.audioUrl} prompt={result.prompt} params={result.params} onSaved={loadLibrary} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            <SfxLibraryList items={library} />
          </div>
        </div>
      </div>
    </div>
  );
}