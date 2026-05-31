import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Music, Upload, Zap, Loader2, Save, Download,
  CheckCircle, Film, RotateCcw, Library, Wand2, X, Sparkles, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import InfoTip from '@/components/common/InfoTip';
import CostBadge from '@/components/credits/CostBadge';
import { handleCreditError, refreshCreditsFromResponse } from '@/utils/creditErrors';
import LibraryTrackPickerModal from './LibraryTrackPickerModal';
import SceneTransitionPicker from './SceneTransitionPicker';
import SceneTemplatesPicker from './SceneTemplatesPicker';
import ScenePreviewThumb from './ScenePreviewThumb';
import { analyzeAudioOnsets, onsetsToSceneDurations } from '@/utils/audioOnsetDetection';

const QUERY_SUGGESTIONS = [
  'city traffic timelapse', 'ocean waves sunset', 'neon lights night',
  'abstract particles', 'mountain landscape', 'rain on window',
  'fire embers slow motion', 'starry night sky', 'forest fog morning',
  'glitch art digital', 'crowd concert lights', 'desert sand dunes',
];

const newScene = (q = '') => ({
  id: crypto.randomUUID(),
  kind: 'broll',
  query: q,
  durationSeconds: 4,
  transitionOut: null,
});

export default function MusicVideoComposer() {
  const [scenes, setScenes] = useState([newScene('city traffic timelapse'), newScene('ocean waves sunset')]);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioTitle, setAudioTitle] = useState('');
  const [audioDuration, setAudioDuration] = useState(0); // seconds
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [composing, setComposing] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [analyzingBeats, setAnalyzingBeats] = useState(false);
  const [previewCache, setPreviewCache] = useState({}); // query → thumbnail_url | null
  const [loadingPreviews, setLoadingPreviews] = useState({}); // query → bool
  const audioProbeRef = useRef(null);

  // Debounced Pexels thumbnail prefetch — looks up any scene query we haven't
  // resolved yet whenever the scene list stabilizes for 600ms.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const uniqueQueries = [...new Set(
        scenes.map(s => s.query?.trim()).filter(q => q && !(q in previewCache))
      )];
      if (uniqueQueries.length === 0) return;

      setLoadingPreviews((prev) => {
        const next = { ...prev };
        uniqueQueries.forEach(q => { next[q] = true; });
        return next;
      });

      try {
        const res = await base44.functions.invoke('searchPexelsPreview', { queries: uniqueQueries });
        const previews = res.data?.previews || [];
        setPreviewCache((prev) => {
          const next = { ...prev };
          previews.forEach(p => { next[p.query] = p.thumbnail_url; });
          return next;
        });
      } catch { /* silent — fall back to placeholder icon */ }

      setLoadingPreviews((prev) => {
        const next = { ...prev };
        uniqueQueries.forEach(q => { delete next[q]; });
        return next;
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [scenes.map(s => s.query).join('|')]);

  // Probe audio duration via a hidden <audio> element. Resolves once metadata loads.
  const probeAudioDuration = (url) => new Promise((resolve) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.src = url;
    a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => resolve(0);
    audioProbeRef.current = a;
  });

  const setAudioFromSource = async (url, title = '') => {
    setAudioUrl(url);
    setAudioTitle(title);
    const dur = await probeAudioDuration(url);
    setAudioDuration(Math.round(dur));
  };

  const clearAudio = () => {
    setAudioUrl(''); setAudioTitle(''); setAudioDuration(0);
  };

  // Auto-fit: divide audio duration evenly across all scenes (min 1s per scene)
  const autoFitScenesToAudio = () => {
    if (!audioDuration || scenes.length === 0) return;
    const per = Math.max(1, Math.floor(audioDuration / scenes.length));
    const remainder = audioDuration - per * scenes.length;
    setScenes((prev) => prev.map((s, i) => ({
      ...s,
      durationSeconds: per + (i === prev.length - 1 ? remainder : 0),
    })));
    toast.success(`Scenes fitted to ${audioDuration}s audio`);
  };

  // Audio-reactive: analyze track for beat onsets, then resize scenes to cut on beat.
  // Adds/removes scenes as needed to match the number of detected onsets + 1 region.
  const fitScenesToBeats = async () => {
    if (!audioUrl) {
      toast.error('Upload or pick a track first');
      return;
    }
    setAnalyzingBeats(true);
    try {
      const { duration, onsets } = await analyzeAudioOnsets(audioUrl, {
        maxOnsets: Math.max(2, Math.min(11, scenes.length + 4)),
      });
      const durations = onsetsToSceneDurations(duration, onsets);
      setScenes((prev) => {
        const next = durations.map((d, i) => ({
          ...(prev[i] || newScene(QUERY_SUGGESTIONS[i % QUERY_SUGGESTIONS.length])),
          durationSeconds: d,
        }));
        return next;
      });
      toast.success(`Cut on beat — ${durations.length} scenes, ${onsets.length} onsets detected`);
    } catch (err) {
      toast.error(`Beat analysis failed: ${err.message}`);
    }
    setAnalyzingBeats(false);
  };

  // Replace scenes from a template's prompt list
  const applyTemplate = (prompts) => {
    setScenes(prompts.map((q) => newScene(q)));
    toast.success(`Loaded ${prompts.length}-scene template`);
  };

  const dims = aspectRatio === '9:16'
    ? { width: 720, height: 1080 }
    : aspectRatio === '1:1'
    ? { width: 720, height: 720 }
    : { width: 1080, height: 720 };

  const totalDuration = scenes.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  // Credit cost matches backend: 5 base + 1/scene + 3 if audio
  const creditCost = 5 + scenes.length + (audioUrl ? 3 : 0);

  const updateScene = (id, patch) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const removeScene = (id) => setScenes((prev) => prev.filter((s) => s.id !== id));
  const addScene = () => setScenes((prev) => [...prev, newScene()]);
  const moveScene = (id, dir) => {
    setScenes((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await setAudioFromSource(file_url, file.name);
      toast.success('Audio uploaded!');
    } catch (err) {
      toast.error(err.message);
    }
    setUploadingAudio(false);
  };

  const compose = async () => {
    const validScenes = scenes.filter((s) => s.query?.trim() && s.durationSeconds > 0);
    if (validScenes.length === 0) {
      toast.error('Add at least one scene with a query');
      return;
    }
    setComposing(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('composeVideoNextCut', {
        scenes: validScenes.map((s) => ({
          kind: s.kind,
          query: s.query,
          durationSeconds: s.durationSeconds,
          transitionOut: s.transitionOut || undefined,
        })),
        audioUrl: audioUrl || undefined,
        ...dims,
        fps: 30,
      });
      if (res.data?.video_url) {
        setResult(res.data);
        refreshCreditsFromResponse(res.data);
        toast.success('🎬 Music video composed!');
      } else {
        toast.error(res.data?.error || 'Composition failed');
      }
    } catch (err) {
      if (!handleCreditError(err)) toast.error(err?.response?.data?.error || err.message);
    }
    setComposing(false);
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
        title: `Music Video (${scenes.length} scenes, ${totalDuration}s)`,
        file_url: result.video_url,
        is_public: false,
        metadata: {
          provider: 'nextcut',
          scenes: scenes.map((s) => ({ query: s.query, duration: s.durationSeconds })),
          aspectRatio,
          audioUrl,
          cost_usd: result.cost_usd,
        },
      });
      toast.success('Saved to library!');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Audio track upload */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5" /> Audio Track
          <InfoTip text="Optional. Upload an MP3/WAV or pick a track from your library. If omitted, the video will be silent." />
        </p>

        {audioUrl ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-emerald-300 truncate">
                {audioTitle || 'Audio ready'}
                {audioDuration > 0 && <span className="text-muted-foreground font-normal ml-1.5">· {audioDuration}s</span>}
              </p>
              <button type="button" onClick={clearAudio} className="text-muted-foreground hover:text-rose-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <audio controls src={audioUrl} className="w-full" />
            {audioDuration > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={autoFitScenesToAudio}
                  className="gap-1.5 rounded-lg text-xs"
                >
                  <Wand2 className="w-3.5 h-3.5" /> Auto-fit ({audioDuration}s)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={fitScenesToBeats}
                  disabled={analyzingBeats}
                  className="gap-1.5 rounded-lg text-xs"
                >
                  {analyzingBeats ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  Cut on beat
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
              <div className="border-2 border-dashed rounded-xl p-3 text-center border-border hover:border-indigo-500 transition-colors">
                {uploadingAudio ? (
                  <Loader2 className="w-5 h-5 mx-auto text-indigo-400 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Upload audio</p>
                  </>
                )}
              </div>
            </label>
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="border-2 border-dashed rounded-xl p-3 text-center border-border hover:border-indigo-500 transition-colors"
            >
              <Library className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">From library</p>
            </button>
          </div>
        )}
      </div>

      {/* Aspect ratio */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Aspect Ratio</p>
        <div className="flex gap-2">
          {[
            { v: '16:9', label: '16:9 YouTube' },
            { v: '9:16', label: '9:16 Reels' },
            { v: '1:1', label: '1:1 Square' },
          ].map((ar) => (
            <button
              key={ar.v}
              type="button"
              onClick={() => setAspectRatio(ar.v)}
              className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${aspectRatio === ar.v ? 'border-indigo-500 bg-indigo-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-indigo-500/40'}`}
            >
              {ar.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scenes editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5" /> Scenes ({scenes.length})
            <InfoTip text="Each scene fetches a Pexels stock clip matching your query. Order them like a storyboard. Total length should roughly match your audio." />
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="text-xs px-2 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-bold flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Templates
            </button>
            <Badge variant="outline" className="text-xs">Total: {totalDuration}s</Badge>
          </div>
        </div>

        {/* Storyboard timeline strip */}
        {totalDuration > 0 && (
          <div className="mb-2 rounded-lg bg-muted/40 border border-border p-1.5 flex gap-0.5 overflow-hidden">
            {scenes.map((s, i) => (
              <div
                key={s.id}
                className="h-5 rounded-sm bg-gradient-to-br from-indigo-500/60 to-purple-500/60 flex items-center justify-center text-[9px] font-bold text-white"
                style={{ flexGrow: s.durationSeconds || 1 }}
                title={`#${i + 1} ${s.query} (${s.durationSeconds}s)`}
              >
                {s.durationSeconds}s
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {scenes.map((scene, idx) => (
            <motion.div
              key={scene.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-xl bg-card border border-border space-y-1"
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveScene(scene.id, -1)}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                  >▲</button>
                  <button
                    type="button"
                    onClick={() => moveScene(scene.id, 1)}
                    disabled={idx === scenes.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                  >▼</button>
                </div>
                <span className="text-xs font-bold text-muted-foreground w-6">#{idx + 1}</span>
                <ScenePreviewThumb
                  url={previewCache[scene.query?.trim()]}
                  loading={!!loadingPreviews[scene.query?.trim()]}
                />
                <Input
                  value={scene.query}
                  onChange={(e) => updateScene(scene.id, { query: e.target.value })}
                  placeholder="e.g. neon city street rain"
                  className="flex-1 text-xs"
                />
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={scene.durationSeconds}
                  onChange={(e) => updateScene(scene.id, { durationSeconds: Number(e.target.value) || 1 })}
                  className="w-16 text-xs text-center"
                />
                <span className="text-xs text-muted-foreground">s</span>
                <button
                  type="button"
                  onClick={() => removeScene(scene.id)}
                  disabled={scenes.length === 1}
                  className="text-muted-foreground hover:text-rose-400 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <SceneTransitionPicker
                value={scene.transitionOut}
                onChange={(v) => updateScene(scene.id, { transitionOut: v })}
                isLast={idx === scenes.length - 1}
              />
            </motion.div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={addScene}
          className="w-full mt-2 gap-2 rounded-xl border-dashed"
        >
          <Plus className="w-4 h-4" /> Add Scene
        </Button>

        {/* Quick suggestions */}
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1.5">Quick add:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUERY_SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setScenes((prev) => [...prev, newScene(q)])}
                className="px-2 py-1 rounded-md text-[10px] font-medium bg-muted text-muted-foreground hover:bg-indigo-500/20 hover:text-indigo-300 transition-all"
              >
                + {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Compose button */}
      <Button
        onClick={compose}
        disabled={composing || scenes.length === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-base py-5 gap-2"
      >
        {composing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Composing… (~{Math.ceil(totalDuration * 3)}s)
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            Compose Music Video
            <CostBadge cost={creditCost} />
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        {creditCost} credits = 5 base + {scenes.length} scene{scenes.length === 1 ? '' : 's'}{audioUrl ? ' + 3 audio mux' : ''}. Pexels footage included free.
      </p>

      {audioDuration > 0 && Math.abs(totalDuration - audioDuration) > 1 && (
        <p className="text-xs text-amber-400 text-center -mt-2">
          ⚠ Scene total ({totalDuration}s) doesn't match audio ({audioDuration}s) — click Auto-fit above.
        </p>
      )}

      <LibraryTrackPickerModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={({ file_url, title }) => setAudioFromSource(file_url, title)}
      />

      <SceneTemplatesPicker
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onPick={applyTemplate}
      />

      {/* Result */}
      <AnimatePresence>
        {result?.video_url && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-4"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">Music Video Ready</span>
              <Badge variant="outline" className="text-xs">{aspectRatio}</Badge>
              <Badge variant="outline" className="text-xs">{result.scene_count} scenes</Badge>
              <Badge variant="outline" className="text-xs">{Math.round(result.duration_s)}s</Badge>
              {typeof result.cost_usd === 'number' && (
                <Badge variant="outline" className="text-xs">${result.cost_usd.toFixed(4)}</Badge>
              )}
            </div>
            <video controls className="w-full rounded-xl" src={result.video_url} />
            <div className="flex gap-2 flex-wrap">
              <Button onClick={saveToLibrary} disabled={saving} className="flex-1 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold">
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
  );
}