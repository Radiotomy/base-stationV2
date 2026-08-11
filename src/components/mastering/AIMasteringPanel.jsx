import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Upload, Loader2, Save, Wand2, Volume2, Music, RotateCcw, Headphones, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import CostBadge from '@/components/credits/CostBadge';
import { handleCreditError, refreshCreditsFromResponse } from '@/utils/creditErrors';
import StereoVUMeter from './StereoVUMeter';
import ScrubWaveformPlayer from './ScrubWaveformPlayer';
import AssetPicker from '@/components/studio/AssetPicker';
import useMasteringChain from '@/hooks/useMasteringChain';
import { decodeAudioFromUrl, renderMasteringOffline } from '@/utils/offlineMastering';
import { audioBufferToWav } from '@/utils/wavEncoder';

// Character sliders — these match the visual sliders in the user's reference
const CHARACTER_SLIDERS = [
  { key: 'radio',        label: 'Radio',        desc: 'Telephone/lo-fi mid presence',     color: 'from-pink-500 to-rose-500' },
  { key: 'destroy',      label: 'Destroy',      desc: 'Harmonic saturation & grit',       color: 'from-red-500 to-orange-500' },
  { key: 'heaven_low',   label: 'Heaven Low',   desc: 'Sub-bass extension & weight',      color: 'from-blue-500 to-indigo-500' },
  { key: 'space',        label: 'Space',        desc: 'Reverb, width & sense of room',    color: 'from-cyan-500 to-teal-500' },
  { key: 'master_punch', label: 'Master Punch', desc: 'Transients, compression, loudness', color: 'from-amber-500 to-yellow-500' },
];

// 7-zone parametric EQ — shared with the live chain + offline renderer
import { PARAMETRIC_EQ_ZONES, DEFAULT_PARAMETRIC_EQ } from '@/config/parametricEQZones';
const EQ_BANDS = PARAMETRIC_EQ_ZONES;

const STYLE_PRESETS = [
  { id: 'streaming', label: '🎧 Streaming', desc: '-14 LUFS · Balanced',  lufs: -14, character: { radio: 10, destroy: 5,  heaven_low: 30, space: 25, master_punch: 55 } },
  { id: 'loud',      label: '🔊 Loud',      desc: '-8 LUFS · Punchy',     lufs: -8,  character: { radio: 15, destroy: 25, heaven_low: 40, space: 15, master_punch: 85 } },
  { id: 'club',      label: '💃 Club',      desc: '-9 LUFS · Heavy bass', lufs: -9,  character: { radio: 5,  destroy: 30, heaven_low: 75, space: 20, master_punch: 90 } },
  { id: 'radio',     label: '📻 Radio',     desc: '-16 LUFS · AM presence', lufs: -16, character: { radio: 70, destroy: 15, heaven_low: 10, space: 10, master_punch: 65 } },
  { id: 'warm',      label: '🌅 Warm',      desc: '-13 LUFS · Analog',    lufs: -13, character: { radio: 20, destroy: 15, heaven_low: 50, space: 35, master_punch: 50 } },
  { id: 'vinyl',     label: '💿 Vinyl',     desc: '-16 LUFS · Smooth',    lufs: -16, character: { radio: 30, destroy: 20, heaven_low: 40, space: 45, master_punch: 40 } },
  { id: 'lofi',      label: '📼 Lo-Fi',     desc: '-15 LUFS · Dusty & warm', lufs: -15, character: { radio: 45, destroy: 35, heaven_low: 25, space: 30, master_punch: 30 } },
  { id: 'balanced',  label: '⚖️ Balanced',  desc: '-12 LUFS · Versatile', lufs: -12, character: { radio: 10, destroy: 10, heaven_low: 35, space: 30, master_punch: 60 } },
];

const DEFAULT_CHARACTER = { radio: 0, destroy: 0, heaven_low: 0, space: 0, master_punch: 0 };
const DEFAULT_EQ = DEFAULT_PARAMETRIC_EQ;

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySelection, setLibrarySelection] = useState([]);
  const [libraryAssets, setLibraryAssets] = useState([]);
  const [sourceMetadata, setSourceMetadata] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [abMode, setAbMode] = useState('mastered'); // 'original' | 'mastered'

  // Stereo controls
  const [balance, setBalance] = useState(0);       // -100 (full L) → +100 (full R)
  const [separation, setSeparation] = useState(0); // -100 (mono) → +100 (extra wide)

  // Export format — 16-bit (streaming) vs 24-bit (Apple / mastering submissions)
  const [bitDepth, setBitDepth] = useState(16);

  // ── Web Audio graph ──
  const ctxRef = useRef(null);
  const [graphReady, setGraphReady] = useState(false);
  const chain = useMasteringChain();

  // Create shared AudioContext once
  useEffect(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);

  // Build the mastering chain when the scrubber gives us the source node
  const handleAudioReady = useCallback((audioEl, source) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    chain.attach(source, ctx);
    setGraphReady(true);
    // Force initial application of current state values
    chain.setBalance(balance);
    chain.setSeparation(separation);
    Object.entries(eq).forEach(([k, v]) => chain.setEQBand(k, v));
    Object.entries(character).forEach(([k, v]) => chain.setCharacter(k, v));
    chain.setLufsTarget(lufsTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain]);

  // Real-time bindings: every slider change flows to the audio graph
  useEffect(() => { if (graphReady) chain.setBalance(balance); }, [balance, graphReady, chain]);
  useEffect(() => { if (graphReady) chain.setSeparation(separation); }, [separation, graphReady, chain]);
  useEffect(() => {
    if (!graphReady) return;
    Object.entries(eq).forEach(([k, v]) => chain.setEQBand(k, v));
  }, [eq, graphReady, chain]);
  useEffect(() => {
    if (!graphReady) return;
    Object.entries(character).forEach(([k, v]) => chain.setCharacter(k, v));
  }, [character, graphReady, chain]);
  useEffect(() => { if (graphReady) chain.setLufsTarget(lufsTarget); }, [lufsTarget, graphReady, chain]);

  const analysers = graphReady ? chain.getAnalysers() : { left: null, right: null };

  const fetchSourceMetadata = async (url) => {
    setSourceMetadata(null);
    try {
      const res = await base44.functions.invoke('extractAudioMetadata', { audio_url: url });
      if (res.data?.metadata) setSourceMetadata(res.data.metadata);
    } catch {
      // Non-critical — metadata display simply stays empty
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setLoadError(null);
    try {
      const r = await base44.integrations.Core.UploadFile({ file });
      setAudioUrl(r.file_url);
      setUploadedFile(file);
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
      setResult(null);
      setAbMode('mastered');
      toast.success('Audio loaded!');
      fetchSourceMetadata(r.file_url);
    } catch (err) { toast.error(err.message); }
    setUploading(false);
  };

  const openLibrary = async () => {
    setLibraryOpen(true);
    setLibrarySelection([]);
    try {
      const me = await base44.auth.me();
      const rows = await base44.entities.UserAsset.filter(
        { user_id: me.id, asset_type: 'track' }, '-created_date', 100
      );
      setLibraryAssets(rows);
    } catch {
      setLibraryAssets([]);
    }
  };

  const confirmLibrarySelection = async () => {
    const id = librarySelection[0];
    const asset = libraryAssets.find(a => a.id === id);
    if (!asset?.file_url) {
      toast.error('Selected track is missing a file URL');
      return;
    }
    setLibraryOpen(false);
    setUploading(true);
    setLoadError(null);
    // A library pick must land in exactly the same state as a fresh upload:
    // any previous render is cleared and the player is torn down, so the
    // preview plays the newly chosen track rather than a stale master.
    setResult(null);
    setAbMode('mastered');
    setAudioUrl('');
    try {
      // Proxy external CDN URLs through Base44 storage so Web Audio + waveform
      // analysis work (CORS headers required for fetch + MediaElementSource).
      const res = await base44.functions.invoke('proxyAudioAsset', {
        source_url: asset.file_url,
        filename: (asset.title || 'library_track') + '.mp3',
      });
      const url = res?.data?.file_url || asset.file_url;
      setAudioUrl(url);
      setUploadedFile({ name: asset.title || 'Library Track' });
      setTitle(asset.title || 'Library Track');
      toast.success('Track loaded — scrub and play to preview live');
      fetchSourceMetadata(url);
    } catch (err) {
      toast.error('Failed to load library track: ' + (err?.message || 'unknown'));
    }
    setUploading(false);
  };

  const applyPreset = (preset) => {
    setStyle(preset.id);
    setCharacter(preset.character);
    setLufsTarget(preset.lufs);
  };

  const resetAll = () => {
    setCharacter(DEFAULT_CHARACTER);
    setEQ(DEFAULT_EQ);
    setLufsTarget(-14);
    setStyle(null);
    setBalance(0);
    setSeparation(0);
  };

  const runMastering = async () => {
    if (!audioUrl) { toast.error('Upload a track first'); return; }
    setMastering(true);
    try {
      // 1. Decode the source audio
      toast.loading('Decoding audio…', { id: 'master' });
      const sourceBuffer = await decodeAudioFromUrl(audioUrl);

      // 2. Render the full DSP chain offline → AudioBuffer
      toast.loading('Rendering master…', { id: 'master' });
      const renderedBuffer = await renderMasteringOffline(sourceBuffer, {
        character,
        eq,
        lufsTarget,
        stereo: { balance, separation },
      });

      // 3. Encode to PCM WAV (16-bit streaming · 24-bit Apple / mastering)
      toast.loading(`Encoding ${bitDepth}-bit WAV…`, { id: 'master' });
      const wavBlob = audioBufferToWav(renderedBuffer, { bitDepth });
      const safeName = (title || 'mastered_track').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '_');
      const wavFile = new File([wavBlob], `${safeName}_master_${bitDepth}bit.wav`, { type: 'audio/wav' });

      // 4. Upload the rendered WAV
      toast.loading('Uploading…', { id: 'master' });
      const uploaded = await base44.integrations.Core.UploadFile({ file: wavFile });

      // 5. Save as a `master` UserAsset
      const me = await base44.auth.me();
      const asset = await base44.entities.UserAsset.create({
        user_id: me.id,
        user_email: me.email,
        asset_type: 'master',
        title: `${title || 'Untitled'} — Mastered`,
        description: `Client-rendered master · ${lufsTarget} LUFS target · style: ${style || 'custom'}`,
        file_url: uploaded.file_url,
        origin: 'creator',
        tags: ['mastered', style || 'custom'],
        metadata: {
          mastering_profile: style || 'custom',
          lufs_target: lufsTarget,
          character,
          eq,
          stereo: { balance, separation },
          duration: renderedBuffer.duration,
          sample_rate: renderedBuffer.sampleRate,
          bit_depth: bitDepth,
          format: `wav-${bitDepth}bit`,
          rendered_client_side: true,
          provenance: {
            created_by: 'mastering_studio',
            dsp: 'web_audio_offline',
          },
        },
      });

      setResult({ asset, profile: { lufs_target: lufsTarget } });
      setAbMode('mastered');
      toast.success('Master rendered & saved to library!', { id: 'master', icon: '✨' });
    } catch (err) {
      toast.dismiss('master');
      if (!handleCreditError(err)) toast.error(err?.message || 'Mastering failed');
    }
    setMastering(false);
  };

  const playbackUrl = (result?.asset?.file_url && abMode === 'mastered') ? result.asset.file_url : audioUrl;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left — Source + Presets + Stereo + LUFS */}
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
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Button
            type="button"
            onClick={openLibrary}
            variant="outline"
            className="w-full rounded-xl text-xs gap-2"
            disabled={uploading}
          >
            <Library className="w-4 h-4" /> Pick from Library
          </Button>
          {audioUrl && (
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Track title" className="rounded-xl text-sm" />
          )}
          {sourceMetadata && (
            <div className="flex flex-wrap gap-2 pt-1">
              {sourceMetadata.container && <Badge variant="outline" className="text-[10px] uppercase">{sourceMetadata.container}</Badge>}
              {sourceMetadata.duration && <Badge variant="outline" className="text-[10px]">{Math.round(sourceMetadata.duration)}s</Badge>}
              {sourceMetadata.bitrate && <Badge variant="outline" className="text-[10px]">{Math.round(sourceMetadata.bitrate / 1000)}kbps</Badge>}
              {sourceMetadata.sample_rate && <Badge variant="outline" className="text-[10px]">{sourceMetadata.sample_rate}Hz</Badge>}
            </div>
          )}
        </div>

        <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Library className="w-4 h-4 text-amber-400" /> Choose a Track
              </DialogTitle>
            </DialogHeader>
            <AssetPicker
              assetType="track"
              multi={false}
              selected={librarySelection}
              onChange={setLibrarySelection}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setLibraryOpen(false)}>Cancel</Button>
              <Button
                onClick={confirmLibrarySelection}
                disabled={librarySelection.length === 0}
                className="bg-gradient-to-r from-amber-600 to-orange-600"
              >
                Load Track
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

        {/* Stereo controls — Balance + Separation */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="text-sm font-black flex items-center gap-2"><Headphones className="w-4 h-4 text-pink-400" /> Stereo Field</h3>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <p className="text-sm font-bold text-foreground">L / R Balance</p>
                <p className="text-xs text-muted-foreground">Shift the mix left or right</p>
              </div>
              <span className="text-sm font-mono font-bold px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 min-w-[3.5rem] text-center">
                {balance === 0 ? 'C' : balance < 0 ? `L${Math.abs(balance)}` : `R${balance}`}
              </span>
            </div>
            <Slider value={[balance]} onValueChange={([v]) => setBalance(v)} min={-100} max={100} step={1} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
              <span>L</span><span>Center</span><span>R</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <p className="text-sm font-bold text-foreground">Separation</p>
                <p className="text-xs text-muted-foreground">Mono → Stereo → Extra Wide</p>
              </div>
              <span className="text-sm font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 min-w-[3.5rem] text-center">
                {separation > 0 ? `+${separation}` : separation}
              </span>
            </div>
            <Slider value={[separation]} onValueChange={([v]) => setSeparation(v)} min={-100} max={100} step={1} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
              <span>Mono</span><span>Stereo</span><span>Wide</span>
            </div>
          </div>
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

        {/* Export bit depth — 16-bit streaming vs 24-bit Apple submissions */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="text-sm font-black">Export Format</h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setBitDepth(16)}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                bitDepth === 16 ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-muted/30 hover:border-amber-500/40'
              }`}>
              <p className="font-bold text-foreground">16-bit WAV</p>
              <p className="text-muted-foreground text-[10px]">Streaming / web · smaller file</p>
            </button>
            <button onClick={() => setBitDepth(24)}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                bitDepth === 24 ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-muted/30 hover:border-amber-500/40'
              }`}>
              <p className="font-bold text-foreground">24-bit WAV</p>
              <p className="text-muted-foreground text-[10px]">Apple Music · mastering · HQ</p>
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Apple Music & most distributors require 24-bit WAV for HD/Lossless masters.
          </p>
        </div>
      </div>

      {/* Right — Scrubber + VU Meter + Character + EQ */}
      <div className="lg:col-span-2 space-y-4">
        {result?.asset?.file_url && (
          <div className="flex items-center gap-2 bg-card rounded-xl border border-border p-2">
            <span className="text-xs font-semibold text-muted-foreground px-2">A/B Compare:</span>
            <Button size="sm" variant={abMode === 'original' ? 'default' : 'ghost'} onClick={() => setAbMode('original')}
              className={`rounded-lg text-xs ${abMode === 'original' ? 'bg-amber-600 hover:bg-amber-500' : ''}`}>
              A · Original
            </Button>
            <Button size="sm" variant={abMode === 'mastered' ? 'default' : 'ghost'} onClick={() => setAbMode('mastered')}
              className={`rounded-lg text-xs ${abMode === 'mastered' ? 'bg-amber-600 hover:bg-amber-500' : ''}`}>
              B · Mastered
            </Button>
          </div>
        )}
        {playbackUrl ? (
          <ScrubWaveformPlayer
            key={playbackUrl}
            audioUrl={playbackUrl}
            audioContext={ctxRef.current}
            onAudioReady={handleAudioReady}
            onPlayingChange={setIsPlaying}
            onLoadError={setLoadError}
          />
        ) : (
          <div className="bg-card rounded-2xl border border-dashed border-border p-10 flex flex-col items-center justify-center">
            <Music className="w-10 h-10 text-muted-foreground mb-2 opacity-30" />
            <p className="text-sm text-muted-foreground">Upload a track or pick one from your library to see the waveform</p>
          </div>
        )}

        {loadError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">This track&apos;s audio could not be read for preview.</strong>{' '}
            Playback and the live sliders need decodable audio — try re-uploading the file directly. ({loadError})
          </div>
        )}

        {/* Stereo VU Meter — always visible, lights up during playback */}
        <StereoVUMeter
          leftAnalyser={analysers.left}
          rightAnalyser={analysers.right}
          active={isPlaying}
        />

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

        {/* 7-Zone Parametric EQ */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black">7-Zone Parametric EQ</h3>
            <p className="text-xs text-muted-foreground">±12 dB · mastering zones</p>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {EQ_BANDS.map(b => (
              <div key={b.key} className="flex flex-col items-center gap-2" title={b.desc}>
                <span className="text-xs font-mono text-foreground">{(eq[b.key] > 0 ? '+' : '') + eq[b.key].toFixed(1)}</span>
                <div className="h-32 flex items-center">
                  <div className="rotate-[270deg] origin-center w-32">
                    <Slider value={[eq[b.key]]} onValueChange={([v]) => setEQ(e => ({ ...e, [b.key]: v }))}
                      min={-12} max={12} step={0.5} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-foreground">{b.label}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{b.hz}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Sub &lt;40Hz: cut to clean headroom · Mud 200–500Hz: wide gentle cuts clear vocals · Air: broad shelf adds sparkle
          </p>
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