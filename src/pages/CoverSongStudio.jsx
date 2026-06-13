import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Library, Loader2, Wand2, Music, Sparkles, Mic, Sliders, Save, Repeat, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import StudioPageHeader from '@/components/studio/StudioPageHeader';
import CostBadge from '@/components/credits/CostBadge';
import AssetPicker from '@/components/studio/AssetPicker';
import CoverSongResult from '@/components/coversong/CoverSongResult';
import CoverAIAssistant from '@/components/coversong/CoverAIAssistant';
import { useJobPolling } from '@/hooks/useJobPolling';
import { handleCreditError } from '@/utils/creditErrors';

// Sonic upload-cover / extend-upload endpoints require v4.5+ to work reliably.
// v3.5 and v4 frequently hang or fail on upload tasks. v5 / v5.5 strongly
// recommended for longer source tracks (> 90s).
const SONIC_MODELS = [
  { id: 'sonic-v5-5',      label: 'Sonic v5.5',      desc: 'Latest · best for long covers', vocalGender: true, recommended: true },
  { id: 'sonic-v5',        label: 'Sonic v5',        desc: 'Recommended · premium quality', vocalGender: true, recommended: true },
  { id: 'sonic-v4-5-plus', label: 'Sonic v4.5+',     desc: 'Enhanced v4.5',                 vocalGender: true },
  { id: 'sonic-v4-5',      label: 'Sonic v4.5',      desc: 'Stable · short tracks only',    vocalGender: true },
];

export default function CoverSongStudio() {
  // Mode: 'cover' = re-imagine in new style · 'extend' = continue the track
  const [taskKind, setTaskKind] = useState('cover');

  // Source
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySelection, setLibrarySelection] = useState([]);

  // Extend-only — where the extension picks up
  const [continueAt, setContinueAt] = useState(0.1);

  // Creative controls
  const [model, setModel] = useState('sonic-v5');
  const [customMode, setCustomMode] = useState(true);     // true = lyrics, false = AI description
  const [lyrics, setLyrics] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');                   // free-form style tags
  const [negativeTags, setNegativeTags] = useState('');
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [vocalGender, setVocalGender] = useState('');     // '', 'f', 'm'
  const [instrumental, setInstrumental] = useState(false);
  const [styleWeight, setStyleWeight] = useState(0.5);
  const [audioWeight, setAudioWeight] = useState(0.5);
  const [weirdness, setWeirdness] = useState(0.3);

  // Job state
  const [jobId, setJobId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const modelMeta = SONIC_MODELS.find(m => m.id === model) || SONIC_MODELS[0];
  const supportsVocalGender = modelMeta.vocalGender;

  // ── Source loaders ────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = await base44.integrations.Core.UploadFile({ file });
      setSourceUrl(r.file_url);
      setSourceLabel(file.name);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, '') + ' (Cover)');
      toast.success('Source audio uploaded!');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const openLibrary = () => { setLibrarySelection([]); setLibraryOpen(true); };

  const confirmLibrary = async () => {
    const id = librarySelection[0];
    if (!id) return;
    setLibraryOpen(false);
    try {
      const rows = await base44.entities.UserAsset.filter({ id });
      const asset = rows[0];
      if (!asset?.file_url) { toast.error('No file URL on that asset'); return; }
      setSourceUrl(asset.file_url);
      setSourceLabel(asset.title || 'Library Track');
      if (!title) setTitle((asset.title || 'Untitled') + ' (Cover)');
      toast.success('Library track loaded!');
    } catch (err) {
      toast.error(err.message || 'Failed to load library track');
    }
  };

  // ── Job polling ───────────────────────────────────────────────────────────
  useJobPolling(
    jobId,
    (data) => {
      setGenerating(false);
      setResult(data);
      setJobId(null);
      toast.success(`${taskKind === 'extend' ? 'Extension' : 'Cover'} ready!`, { icon: '✨' });
    },
    (err) => {
      setGenerating(false);
      setJobId(null);
      toast.error(err || 'Cover generation failed');
    },
    80,
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  const runGenerate = async () => {
    console.log('[CoverStudio] Generate clicked', { taskKind, sourceUrl, customMode, hasLyrics: !!lyrics.trim(), instrumental });
    if (!sourceUrl) {
      toast.error('Add a source track first — upload or pick from library', { duration: 5000 });
      return;
    }
    if (customMode && !lyrics.trim() && !instrumental) {
      toast.error('Add lyrics (or toggle Instrumental / switch to AI Description tab)', { duration: 5000 });
      return;
    }
    if (!customMode && !aiDescription.trim()) {
      toast.error('Add an AI style description', { duration: 5000 });
      return;
    }

    setGenerating(true);
    setResult(null);
    try {
      const fn = taskKind === 'extend' ? 'extendUploadedMusic' : 'generateCoverSong';
      const payload = {
        url: sourceUrl,
        mv: model,
        custom_mode: customMode,
        prompt: customMode ? lyrics : undefined,
        gpt_description_prompt: !customMode ? aiDescription : undefined,
        title: title || undefined,
        tags: tags || undefined,
        negative_tags: negativeTags || undefined,
        make_instrumental: instrumental,
        style_weight: styleWeight,
        weirdness_constraint: weirdness,
        audio_weight: audioWeight,
        vocal_gender: supportsVocalGender ? (vocalGender || undefined) : undefined,
        genre: genre || undefined,
        mood: mood || undefined,
        ...(taskKind === 'extend' && { continue_at: continueAt }),
      };
      const res = await base44.functions.invoke(fn, payload);
      const j = res.data?.job_id;
      if (!j) throw new Error(res.data?.error || 'No job_id returned');
      setJobId(j);
      toast.success(`${taskKind === 'extend' ? 'Extension' : 'Cover'} started — this can take 1-2 minutes…`);
    } catch (err) {
      setGenerating(false);
      if (!handleCreditError(err)) {
        toast.error(err?.response?.data?.error || err.message || 'Failed to start');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader
        icon={Mic}
        accent="rose"
        title="Cover & Extend Studio"
        subtitle="Upload any track. Re-imagine it in a new style — or extend it with new sections."
        badge="Sonic Upload"
      />

      {/* Mode switcher */}
      <div className="max-w-7xl mx-auto px-6 pt-2">
        <div className="merc-card rounded-2xl p-1.5 inline-flex gap-1">
          <button
            onClick={() => setTaskKind('cover')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              taskKind === 'cover' ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" /> Cover Song
          </button>
          <button
            onClick={() => setTaskKind('extend')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              taskKind === 'extend' ? 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FastForward className="w-3.5 h-3.5" /> Extend Track
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {taskKind === 'cover'
            ? 'Re-imagine your track in any new style, genre, or mood.'
            : 'Continue your track from a specific point with new sections.'}
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Source + Model */}
        <div className="space-y-4">
          {/* Source */}
          <div className="merc-card rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Music className="w-4 h-4 text-rose-400" /> Source Track
            </h3>
            <label className={`block cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              <input type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
              <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-rose-500 transition-colors">
                {uploading ? <Loader2 className="w-6 h-6 mx-auto text-rose-400 animate-spin" />
                           : <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />}
                <p className="text-xs text-muted-foreground">
                  {sourceLabel || 'Upload audio (≤ 8 min, MP3/WAV/FLAC)'}
                </p>
              </div>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <Button type="button" onClick={openLibrary} variant="outline" className="w-full rounded-xl text-xs gap-2">
              <Library className="w-4 h-4" /> Pick from Library
            </Button>
            {sourceUrl && (
              <audio src={sourceUrl} controls className="w-full mt-2 rounded-lg" />
            )}
          </div>

          {/* Model */}
          <div className="merc-card rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fuchsia-400" /> Model Version
            </h3>
            <div className="space-y-1.5">
              {SONIC_MODELS.map(m => (
                <button key={m.id} onClick={() => setModel(m.id)}
                  className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all ${
                    model === m.id ? 'border-rose-500 bg-rose-500/10' : 'border-border bg-muted/30 hover:border-rose-500/40'
                  }`}>
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="font-bold text-foreground">{m.label}</p>
                    <div className="flex items-center gap-1">
                      {m.recommended && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-300 border-emerald-500/40">★</Badge>}
                      {m.vocalGender && <Badge variant="outline" className="text-[9px]">VG</Badge>}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-[10px]">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="merc-card rounded-2xl p-5 space-y-2">
            <h3 className="text-sm font-black">{taskKind === 'extend' ? 'Extended Track Title' : 'Cover Title'}</h3>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={taskKind === 'extend' ? 'My Extended Track' : 'My Cover Version'}
              maxLength={80} className="rounded-xl text-sm" />
            <p className="text-[10px] text-muted-foreground">Max 80 chars</p>
          </div>

          {/* Extend-only: continue-at marker */}
          {taskKind === 'extend' && (
            <div className="merc-card rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-black flex items-center gap-2">
                <FastForward className="w-4 h-4 text-fuchsia-400" /> Continue At
              </h3>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={continueAt}
                  onChange={e => setContinueAt(Math.max(0, Number(e.target.value) || 0))}
                  step={0.1} min={0}
                  className="rounded-xl text-sm flex-1"
                />
                <span className="text-xs font-mono text-muted-foreground">sec</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Seconds into the source where the new content begins. <code className="text-fuchsia-400">0.1</code> is recommended.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT — Creative controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mode tabs */}
          <div className="merc-card rounded-2xl p-5 space-y-3">
            <Tabs value={customMode ? 'lyrics' : 'ai'} onValueChange={(v) => setCustomMode(v === 'lyrics')}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="lyrics" className="gap-1.5"><Mic className="w-3.5 h-3.5" /> Custom Lyrics</TabsTrigger>
                <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Description</TabsTrigger>
              </TabsList>

              <TabsContent value="lyrics" className="space-y-2 pt-3">
                <p className="text-xs text-muted-foreground">
                  Provide your own lyrics. Use <code className="text-rose-400">[Verse]</code>, <code className="text-rose-400">[Chorus]</code>, <code className="text-rose-400">[Bridge]</code> section tags.
                </p>
                <Textarea
                  value={lyrics}
                  onChange={e => setLyrics(e.target.value)}
                  placeholder={`[Verse]\nNew lyrics for the cover\nA different melody\n\n[Chorus]\nCover song, cover song\nSing along with me`}
                  rows={10}
                  maxLength={modelMeta.id.includes('v4-5') || modelMeta.id.includes('v5') ? 5000 : 3000}
                  className="rounded-xl font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground text-right">
                  {lyrics.length} / {modelMeta.id.includes('v4-5') || modelMeta.id.includes('v5') ? 5000 : 3000}
                </p>
              </TabsContent>

              <TabsContent value="ai" className="space-y-2 pt-3">
                <p className="text-xs text-muted-foreground">
                  Describe the style. The AI writes lyrics and arranges automatically.
                </p>
                <Textarea
                  value={aiDescription}
                  onChange={e => setAiDescription(e.target.value)}
                  placeholder="An acoustic indie-folk cover with soft strings and intimate vocals, melancholic and warm"
                  rows={5}
                  maxLength={400}
                  className="rounded-xl text-xs"
                />
                <p className="text-[10px] text-muted-foreground text-right">{aiDescription.length} / 400</p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Style controls */}
          <div className="merc-card rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" /> Style & Vibe
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground">Genre</label>
                <Input value={genre} onChange={e => setGenre(e.target.value)}
                  placeholder="e.g. acoustic, lo-fi, country, k-pop, drill"
                  className="rounded-xl text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">Mood</label>
                <Input value={mood} onChange={e => setMood(e.target.value)}
                  placeholder="e.g. melancholic, euphoric, dark, romantic"
                  className="rounded-xl text-sm mt-1" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground">Style Tags (extra)</label>
              <Input value={tags} onChange={e => setTags(e.target.value)}
                placeholder="e.g. female vocal, fingerstyle guitar, vintage tape, 808s"
                className="rounded-xl text-sm mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Comma-separated. No restrictions — describe anything.</p>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground">Negative Tags (avoid)</label>
              <Input value={negativeTags} onChange={e => setNegativeTags(e.target.value)}
                placeholder="e.g. autotune, electronic drums, screamo"
                className="rounded-xl text-sm mt-1" />
            </div>

            {/* Vocal gender (model-gated) */}
            {supportsVocalGender && (
              <div>
                <label className="text-xs font-bold text-foreground">Vocal Gender</label>
                <div className="flex gap-2 mt-1">
                  {[
                    { id: '',  label: 'Auto' },
                    { id: 'f', label: 'Female' },
                    { id: 'm', label: 'Male' },
                  ].map(g => (
                    <button key={g.id} onClick={() => setVocalGender(g.id)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        vocalGender === g.id ? 'border-rose-500 bg-rose-500/15 text-rose-200' : 'border-border bg-muted/30 text-muted-foreground hover:border-rose-500/40'
                      }`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border">
              <div>
                <p className="text-xs font-bold text-foreground">Instrumental</p>
                <p className="text-[10px] text-muted-foreground">No vocals — instrumental cover only</p>
              </div>
              <Switch checked={instrumental} onCheckedChange={setInstrumental} />
            </div>
          </div>

          {/* Weights */}
          <div className="merc-card rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-black">Generation Weights</h3>

            {[
              { key: 'style',  label: 'Style Weight',  desc: 'How strictly to follow style tags',  value: styleWeight, set: setStyleWeight, color: 'text-rose-300' },
              { key: 'audio',  label: 'Audio Weight',  desc: 'How closely to follow source audio', value: audioWeight, set: setAudioWeight, color: 'text-cyan-300' },
              { key: 'weird',  label: 'Weirdness',     desc: 'Experimental / unexpected choices',  value: weirdness,   set: setWeirdness,   color: 'text-amber-300' },
            ].map(s => (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <p className="text-xs font-bold text-foreground">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                  </div>
                  <span className={`text-xs font-mono font-bold ${s.color} px-2 py-0.5 rounded-md bg-white/5`}>
                    {s.value.toFixed(2)}
                  </span>
                </div>
                <Slider value={[s.value]} onValueChange={([v]) => s.set(v)} min={0} max={1} step={0.01} />
              </div>
            ))}
          </div>

          {/* AI Assistant — fills missing fields with smart suggestions */}
          <CoverAIAssistant
            taskKind={taskKind}
            sourceLabel={sourceLabel}
            customMode={customMode}
            lyrics={lyrics}
            aiDescription={aiDescription}
            title={title}
            tags={tags}
            negativeTags={negativeTags}
            genre={genre}
            mood={mood}
            vocalGender={vocalGender}
            instrumental={instrumental}
            onApply={(s) => {
              if (s.title !== undefined) setTitle(s.title.slice(0, 80));
              if (s.genre !== undefined) setGenre(s.genre);
              if (s.mood !== undefined) setMood(s.mood);
              if (s.tags !== undefined) setTags(s.tags);
              if (s.negative_tags !== undefined) setNegativeTags(s.negative_tags);
              if (s.vocal_gender !== undefined && supportsVocalGender) setVocalGender(s.vocal_gender);
              if (s.lyrics !== undefined) {
                setLyrics(s.lyrics);
                setCustomMode(true);
              }
              if (s.ai_description !== undefined) {
                setAiDescription(s.ai_description.slice(0, 400));
                setCustomMode(false);
              }
            }}
          />

          {/* Generate */}
          <Button
            onClick={runGenerate}
            disabled={generating || !sourceUrl}
            className="w-full bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 rounded-xl font-bold py-6 gap-2"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            {generating
              ? (taskKind === 'extend' ? 'Extending…' : 'Generating cover…')
              : (taskKind === 'extend' ? 'Extend Track' : 'Generate Cover Song')}
            {!generating && <CostBadge cost={10} />}
          </Button>

          {/* Result */}
          {result && <CoverSongResult data={result} sourceUrl={sourceUrl} title={title} />}
        </div>
      </div>

      {/* Library picker */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Library className="w-4 h-4 text-rose-400" /> Choose a Track</DialogTitle>
          </DialogHeader>
          <AssetPicker assetType="track" multi={false} selected={librarySelection} onChange={setLibrarySelection} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLibraryOpen(false)}>Cancel</Button>
            <Button onClick={confirmLibrary} disabled={librarySelection.length === 0}
              className="bg-gradient-to-r from-rose-600 to-fuchsia-600">
              Load Track
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}