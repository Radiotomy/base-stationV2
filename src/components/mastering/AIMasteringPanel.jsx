import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Upload, Loader2, Save, Wand2, Volume2, Music, RotateCcw, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import CostBadge from '@/components/credits/CostBadge';
import { handleCreditError, refreshCreditsFromResponse } from '@/utils/creditErrors';

// Character sliders — these match the visual sliders in the user's reference
const CHARACTER_SLIDERS = [
  { key: 'radio',        label: 'Radio',        desc: 'Telephone/lo-fi mid presence',     color: 'from-pink-500 to-rose-500' },
  { key: 'destroy',      label: 'Destroy',      desc: 'Harmonic saturation & grit',       color: 'from-red-500 to-orange-500' },
  { key: 'heaven_low',   label: 'Heaven Low',   desc: 'Sub-bass extension & weight',      color: 'from-blue-500 to-indigo-500' },
  { key: 'space',        label: 'Space',        desc: 'Reverb, width & sense of room',    color: 'from-cyan-500 to-teal-500' },
  { key: 'master_punch', label: 'Master Punch', desc: 'Transients, compression, loudness', color: 'from-amber-500 to-yellow-500' },
];

const EQ_BANDS = [
  { key: 'low',     label: 'Low',      hz: '60Hz' },
  { key: 'lowMid',  label: 'Low Mid',  hz: '250Hz' },
  { key: 'mid',     label: 'Mid',      hz: '1kHz' },
  { key: 'highMid', label: 'High Mid', hz: '4kHz' },
  { key: 'high',    label: 'High',     hz: '12kHz' },
];

const STYLE_PRESETS = [
  { id: 'streaming', label: '🎧 Streaming', desc: '-14 LUFS · Balanced',  character: { radio: 10, destroy: 5,  heaven_low: 30, space: 25, master_punch: 55 } },
  { id: 'loud',      label: '🔊 Loud',      desc: '-8 LUFS · Punchy',     character: { radio: 15, destroy: 25, heaven_low: 40, space: 15, master_punch: 85 } },
  { id: 'club',      label: '💃 Club',      desc: '-7 LUFS · Heavy bass', character: { radio: 5,  destroy: 30, heaven_low: 75, space: 20, master_punch: 90 } },
  { id: 'warm',      label: '🌅 Warm',      desc: '-13 LUFS · Analog',    character: { radio: 20, destroy: 15, heaven_low: 50, space: 35, master_punch: 50 } },
  { id: 'vinyl',     label: '💿 Vinyl',     desc: '-16 LUFS · Smooth',    character: { radio: 30, destroy: 20, heaven_low: 40, space: 45, master_punch: 40 } },
  { id: 'balanced',  label: '⚖️ Balanced',  desc: '-12 LUFS · Versatile', character: { radio: 10, destroy: 10, heaven_low: 35, space: 30, master_punch: 60 } },
];

const DEFAULT_CHARACTER = { radio: 0, destroy: 0, heaven_low: 0, space: 0, master_punch: 0 };
const DEFAULT_EQ = { low: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 };

export default function AIMasteringPanel() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [title, setTitle] = useState('');
  const [character, setCharacter] = useState(DEFAULT_CHARACTER);
  const [eq, setEQ] = useState(DEFAULT_EQ);
  const [lufsTarget, setLufsTarget] = useState(-14);
  const [style, setStyle] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [mastering, setMastering] = useState(false);
  const [result, setResult] = useState(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = await base44.integrations.Core.UploadFile({ file });
      setAudioUrl(r.file_url);
      setUploadedFile(file);
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
      setResult(null);
      toast.success('Audio loaded!');
    } catch (err) { toast.error(err.message); }
    setUploading(false);
  };

  const applyPreset = (preset) => {
    setStyle(preset.id);
    setCharacter(preset.character);
    setLufsTarget(STYLE_PRESETS.find(s => s.id === preset.id)?.id === 'club' ? -7 :
                  preset.id === 'loud' ? -8 :
                  preset.id === 'streaming' ? -14 :
                  preset.id === 'warm' ? -13 :
                  preset.id === 'vinyl' ? -16 : -12);
  };

  const resetAll = () => {
    setCharacter(DEFAULT_CHARACTER);
    setEQ(DEFAULT_EQ);
    setLufsTarget(-14);
    setStyle(null);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => setPlaying(false);
    a.addEventListener('ended', onEnd);
    return () => a.removeEventListener('ended', onEnd);
  }, [audioUrl, result]);

  const runMastering = async () => {
    if (!audioUrl) { toast.error('Upload a track first'); return; }
    setMastering(true);
    try {
      const res = await base44.functions.invoke('aiMastering', {
        audio_url: audioUrl,
        character,
        eq,
        lufs_target: lufsTarget,
        style: style || 'custom',
        title,
      });
      setResult(res.data);
      refreshCreditsFromResponse(res.data);
      toast.success('Master complete!', { icon: '✨' });
    } catch (err) {
      if (!handleCreditError(err)) toast.error(err?.response?.data?.error || err.message);
    }
    setMastering(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left — Source + Presets */}
      <div className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="text-sm font-black flex items-center gap-2"><Music className="w-4 h-4 text-amber-400" /> Source Track</h3>
          <label className={`block cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
            <input type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-amber-500 transition-colors">
              {uploading ? <Loader2 className="w-6 h-6 mx-auto text-amber-400 animate-spin" />
                         : <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />}
              <p className="text-xs text-muted-foreground">{uploadedFile ? uploadedFile.name : 'Click to upload (MP3, WAV, FLAC)'}</p>
            </div>
          </label>
          {audioUrl && (
            <>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Track title" className="rounded-xl text-sm" />
              <div className="flex items-center gap-2">
                <Button onClick={togglePlay} size="icon" variant="outline" className="rounded-xl flex-shrink-0">
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <audio ref={audioRef} src={audioUrl} className="hidden" />
                <p className="text-xs text-muted-foreground">Preview source</p>
              </div>
            </>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="text-sm font-black">Style Presets</h3>
          <div className="grid grid-cols-2 gap-2">
            {STYLE_PRESETS.map(p => (
              <button key={p.id} onClick={() => applyPreset(p)}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all ${style === p.id
                  ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-muted/30 hover:border-amber-500/40'}`}>
                <p className="font-bold text-foreground">{p.label}</p>
                <p className="text-muted-foreground text-[10px]">{p.desc}</p>
              </button>
            ))}
          </div>
          <Button onClick={resetAll} variant="ghost" size="sm" className="w-full rounded-xl text-xs gap-1.5">
            <RotateCcw className="w-3 h-3" /> Reset all
          </Button>
        </div>

        {/* LUFS target */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black flex items-center gap-2"><Volume2 className="w-4 h-4 text-cyan-400" /> Loudness Target</h3>
            <Badge variant="outline" className="text-xs">{lufsTarget} LUFS</Badge>
          </div>
          <Slider value={[lufsTarget]} onValueChange={([v]) => setLufsTarget(v)} min={-20} max={-6} step={0.5} />
          <p className="text-xs text-muted-foreground">
            Streaming: -14 · Loud: -8 · Club: -7 · Vinyl: -16
          </p>
        </div>
      </div>

      {/* Right — Character & EQ */}
      <div className="lg:col-span-2 space-y-4">
        {/* Character sliders — the 5 from the user spec */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" /> Character</h3>
            <p className="text-xs text-muted-foreground">0 → 100</p>
          </div>
          <div className="space-y-4">
            {CHARACTER_SLIDERS.map(s => (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <p className="text-sm font-bold text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded-md bg-gradient-to-r ${s.color} text-white min-w-[3rem] text-center`}>
                    {character[s.key].toFixed(0).padStart(2, '0')}
                  </span>
                </div>
                <Slider
                  value={[character[s.key]]}
                  onValueChange={([v]) => { setCharacter(c => ({ ...c, [s.key]: v })); setStyle(null); }}
                  min={0} max={100} step={1}
                />
              </div>
            ))}
          </div>
        </div>

        {/* EQ band sliders */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black">5-Band EQ</h3>
            <p className="text-xs text-muted-foreground">±12 dB</p>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {EQ_BANDS.map(b => (
              <div key={b.key} className="flex flex-col items-center gap-2">
                <span className="text-xs font-mono text-foreground">{(eq[b.key] > 0 ? '+' : '') + eq[b.key].toFixed(1)}</span>
                <div className="h-32 flex items-center">
                  <div className="rotate-[270deg] origin-center w-32">
                    <Slider value={[eq[b.key]]} onValueChange={([v]) => setEQ(e => ({ ...e, [b.key]: v }))}
                      min={-12} max={12} step={0.5} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-foreground">{b.label}</p>
                  <p className="text-[10px] text-muted-foreground">{b.hz}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action */}
        <Button onClick={runMastering} disabled={mastering || !audioUrl}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-xl font-bold py-6 gap-2">
          {mastering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
          {mastering ? 'Mastering…' : 'Master with AI'}
          {!mastering && <CostBadge cost={6} />}
        </Button>

        {/* Result */}
        {result?.asset && (
          <div className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">Master Ready</span>
              <Badge variant="outline" className="text-xs ml-auto">{result.profile?.lufs_target} LUFS</Badge>
            </div>
            <p className="text-sm font-semibold text-foreground">{result.asset.title}</p>
            <audio controls className="w-full rounded-xl" src={result.asset.file_url} />
            <div className="flex gap-2">
              <a href={result.asset.file_url} download className="flex-1">
                <Button variant="outline" className="w-full rounded-xl gap-2">
                  <Save className="w-4 h-4" /> Download
                </Button>
              </a>
              <Button onClick={() => setResult(null)} variant="ghost" className="rounded-xl">
                Master Another
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}