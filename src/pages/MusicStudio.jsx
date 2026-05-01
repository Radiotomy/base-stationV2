import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, Play, Download, Zap, ArrowLeft, Save, RotateCcw,
  Clock, CheckCircle, AlertCircle, Upload, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useJobPolling } from '@/hooks/useJobPolling';

const PROVIDERS = [
  { value: 'loudly',   label: 'Loudly',    desc: 'Fast, high quality',    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'nuro',     label: 'Nuro',      desc: 'Vocals + lyrics',       color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  { value: 'sonic',    label: 'Sonic',     desc: 'Stem extraction',       color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { value: 'producer', label: 'Producer',  desc: 'Full production',       color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
];

const GENRE_CHIPS = ['Hip-Hop', 'Trap', 'EDM', 'House', 'Pop', 'R&B', 'Lo-Fi', 'Jazz', 'Rock', 'Afrobeats', 'Drill', 'Ambient'];
const MOOD_CHIPS  = ['Energetic', 'Chill', 'Dark', 'Happy', 'Sad', 'Uplifting', 'Aggressive', 'Romantic', 'Melancholic'];

const PROMPT_TEMPLATES = [
  { label: '🔥 Trap Banger', prompt: 'Hard-hitting 808s, hi-hat rolls, melodic vocal chops, dark atmosphere' },
  { label: '🌊 Lo-Fi Study', prompt: 'Warm vinyl crackle, mellow piano, slow jazz drums, cozy late-night vibe' },
  { label: '⚡ EDM Drop',    prompt: 'Building tension, massive synth drop, festival crowd energy, euphoric leads' },
  { label: '🎷 Neo Soul',    prompt: 'Soulful Rhodes piano, live bass groove, lush harmonies, smooth R&B feel' },
  { label: '🌙 Chill R&B',   prompt: 'Soft drum machine, warm pads, falsetto vibes, late-night feels' },
  { label: '🎸 Indie Rock',  prompt: 'Distorted guitar riffs, driving drums, anthemic chorus, raw energy' },
];

const DURATIONS = [15, 30, 60, 90, 120];

function CreditEstimate({ provider, duration }) {
  const estimates = { loudly: 1, nuro: 3, sonic: 2, producer: 4 };
  const base = estimates[provider] || 2;
  const total = Math.ceil(base * (duration / 30));
  return (
    <span className="text-xs text-yellow-400 font-semibold">~{total} credits</span>
  );
}

export default function MusicStudio() {
  const [provider, setProvider] = useState('loudly');
  const [duration, setDuration] = useState(30);
  const [genre, setGenre] = useState('Hip-Hop');
  const [mood, setMood] = useState('Energetic');
  const [tempo, setTempo] = useState('120');
  const [soundPrompt, setSoundPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const onComplete = useCallback((data) => {
    setGenerating(false);
    setResult(data);
    toast.success('🎵 Track ready!');
  }, []);

  const onError = useCallback((msg) => {
    setGenerating(false);
    toast.error(msg || 'Generation failed');
  }, []);

  const { status, progress } = useJobPolling(jobId, onComplete, onError);

  const isProcessing = generating || (jobId && status === 'processing');

  const generate = async () => {
    setGenerating(true);
    setResult(null);
    setJobId('');
    try {
      const res = await base44.functions.invoke('generateMusic', {
        provider, duration, genre, mood,
        tempo: parseInt(tempo) || 120,
        sound_prompt: soundPrompt || `${mood} ${genre} track`,
      });
      if (res.data?.audio_url || res.data?.output_url) {
        // Synchronous result
        setResult(res.data);
        setGenerating(false);
        toast.success('🎵 Track ready!');
      } else if (res.data?.job_id) {
        setJobId(res.data.job_id);
        toast.success('Generation started — polling for result…');
      } else {
        setGenerating(false);
        toast.error('Unexpected response from provider');
      }
    } catch (err) {
      setGenerating(false);
      toast.error(err.message);
    }
  };

  const saveToLibrary = async () => {
    if (!result?.audio_url && !result?.output_url) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: `${mood} ${genre} — ${provider}`,
        file_url: result.audio_url || result.output_url,
        thumbnail_url: result.cover_image_url || '',
        is_public: false,
        metadata: { genre, mood, tempo, provider, duration, bpm: result.bpm, key: result.key },
      });
      toast.success('Saved to library!');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const audioUrl = result?.audio_url || result?.output_url;

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <div className="flex-1" />
        <CreditEstimate provider={provider} duration={duration} />
        <Badge variant="outline" className="text-xs">⚡ Phase 4</Badge>
      </div>

      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-blue-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎵 Music Studio</h1>
          <p className="text-white/60 text-lg">AI tracks via Loudly, Nuro, Sonic, or Producer — with real-time polling & library save.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-6">

        {/* Provider Chips */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Provider</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PROVIDERS.map(p => (
              <button key={p.value} type="button" onClick={() => setProvider(p.value)}
                className={`p-3 rounded-xl border text-left transition-all ${provider === p.value ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-blue-500/40 bg-card'}`}>
                <p className="text-sm font-bold text-foreground">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Controls */}
          <div className="lg:col-span-1 space-y-5">

            {/* Genre Chips */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Genre</p>
              <div className="flex flex-wrap gap-1.5">
                {GENRE_CHIPS.map(g => (
                  <button key={g} type="button" onClick={() => setGenre(g)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${genre === g ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood Chips */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Mood</p>
              <div className="flex flex-wrap gap-1.5">
                {MOOD_CHIPS.map(m => (
                  <button key={m} type="button" onClick={() => setMood(m)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${mood === m ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Duration: <span className="text-foreground">{duration}s</span></p>
              <div className="flex gap-2 flex-wrap">
                {DURATIONS.map(d => (
                  <button key={d} type="button" onClick={() => setDuration(d)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${duration === d ? 'bg-cyan-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* BPM */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Tempo (BPM)</p>
              <Input type="number" value={tempo} onChange={e => setTempo(e.target.value)} min="60" max="200" className="rounded-xl" />
            </div>
          </div>

          {/* Right: Prompt + Output */}
          <div className="lg:col-span-2 space-y-5">

            {/* Prompt Templates */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Prompt Templates</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PROMPT_TEMPLATES.map(t => (
                  <button key={t.label} type="button" onClick={() => setSoundPrompt(t.prompt)}
                    className={`p-2 rounded-xl border text-left text-xs font-medium transition-all ${soundPrompt === t.prompt ? 'border-blue-500 bg-blue-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-blue-500/40'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Sound Description (optional)</p>
              <textarea
                value={soundPrompt}
                onChange={e => setSoundPrompt(e.target.value)}
                placeholder="Describe the sound: e.g. hard 808s, mellow Rhodes, driving guitar riff…"
                rows={3}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Generate Button */}
            <Button onClick={generate} disabled={isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-base py-5 gap-2">
              <Zap className="w-5 h-5" />
              {isProcessing ? (jobId ? `Processing… ${progress}%` : 'Starting…') : 'Generate Track'}
            </Button>

            {/* Progress */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-blue-500/20 overflow-hidden">
                      <motion.div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress || 10}%` }} animate={{ width: `${progress || 10}%` }} />
                    </div>
                    <p className="text-xs text-blue-300 mt-1">AI is composing your track — this takes 20–60s depending on provider…</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result */}
            <AnimatePresence>
              {audioUrl && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">Track Ready</span>
                    {result?.bpm && <Badge variant="outline" className="text-xs">{result.bpm} BPM</Badge>}
                    {result?.key && <Badge variant="outline" className="text-xs">{result.key}</Badge>}
                  </div>
                  <audio controls className="w-full rounded-xl" src={audioUrl} />
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={saveToLibrary} disabled={saving}
                      className="flex-1 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold">
                      <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save to Library'}
                    </Button>
                    <a href={audioUrl} download className="flex-1">
                      <Button variant="outline" className="w-full gap-2 rounded-xl">
                        <Download className="w-4 h-4" /> Download
                      </Button>
                    </a>
                    <Button variant="outline" onClick={() => { setResult(null); setJobId(''); }} className="gap-2 rounded-xl">
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