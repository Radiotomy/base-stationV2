import React, { useState, useCallback, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Mic2, CheckCircle, Download, Save, RotateCcw, Sparkles, Image, Palette, ChevronsRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useJobPolling } from '@/hooks/useJobPolling';
import MidiExportButton from '@/components/music/MidiExportButton';
import { cacheManager } from '@/utils/cacheManager';
import ChipSelector from '@/components/music/ChipSelector';

const PROVIDERS = [
  { value: 'sonic',     label: 'Sonic',    emoji: '🎵' },
  { value: 'tempcolor', label: 'Tempolor', emoji: '🎶' },
  { value: 'producer',  label: 'Producer', emoji: '🎤' },
  { value: 'nuro',      label: 'Nuro',     emoji: '🎼' },
  { value: 'loudly',    label: 'Loudly',   emoji: '🔊' },
];

const QUICK_EXAMPLES = [
  'An upbeat summer pop anthem with catchy hooks and bright synths',
  'A dark, moody trap banger with heavy 808s and haunting melodies',
  'Chill lo-fi hip-hop perfect for late night studying',
  'An energetic EDM festival banger with a massive drop',
  'Smooth neo-soul R&B with soulful vocals and live bass',
];

const GENRE_OPTIONS = ['Hip-Hop', 'Trap', 'EDM', 'House', 'Pop', 'R&B', 'Lo-Fi', 'Jazz', 'Rock', 'Country', 'Red Dirt Country', 'Afrobeats', 'Drill', 'Ambient', 'Indie'];

export default function QuickGenerateTab() {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState('sonic');
  const [selectedGenre, setSelectedGenre] = useState(''); // user-selected genre (overrides AI)
  const [voicePersonas, setVoicePersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState('auto');
  const [generating, setGenerating] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [extending, setExtending] = useState(false);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [aiParams, setAiParams] = useState(null); // what AI decided
  const savedRef = useRef(false); // prevent duplicate auto-saves

  useEffect(() => {
    base44.auth.me().then(user => {
      base44.entities.VoicePersona.filter({ user_id: user.id }, '-created_date', 10)
        .then(setVoicePersonas)
        .catch(() => {});
    }).catch(() => {});
  }, []);

  const generateCoverArtUrl = async (trackTitle, mood, genre) => {
    try {
      const coverRes = await base44.integrations.Core.GenerateImage({
        prompt: `Music album cover artwork. Style: ${genre}. Mood: ${mood}. Visual theme matching "${trackTitle}". Bold composition, dramatic lighting, professional music industry aesthetic. No text overlays.`,
      });
      return coverRes.url || null;
    } catch (e) {
      return null;
    }
  };

  const saveTrackToLibrary = useCallback(async (audioUrl, coverImageUrl, params) => {
    if (!audioUrl) return;
    try {
      const user = await base44.auth.me();
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: params?.title || prompt.slice(0, 40) || 'Generated Track',
        file_url: audioUrl,
        thumbnail_url: coverImageUrl || '',
        is_public: false,
        metadata: {
          genre: params?.genre,
          mood: params?.mood,
          bpm: params?.bpm,
          provider,
          duration: params?.duration,
          ai_assisted: true,
          prompt,
          auto_saved: true,
        },
      });
    } catch (err) {
      console.warn('Auto-save failed:', err.message);
    }
  }, [prompt, provider]);

  // Use a ref so onComplete always has access to the latest aiParams even when called from polling
  const aiParamsRef = React.useRef(null);
  const promptRef = React.useRef('');

  const onComplete = useCallback(async (data) => {
    if (savedRef.current) return; // prevent duplicate calls
    savedRef.current = true;
    setGenerating(false);
    setResult(data);
    toast.success(data?.audio_urls?.length > 1 ? `🎵 ${data.audio_urls.length} tracks ready!` : '🎵 Track ready!');

    const params = aiParamsRef.current;
    const currentPrompt = promptRef.current;

    // Always generate cover art (gracefully skip if it fails)
    let coverImageUrl = data.cover_image_url || null;
    if (!coverImageUrl) {
      setGeneratingCover(true);
      try {
        coverImageUrl = await generateCoverArtUrl(
          params?.title || currentPrompt.slice(0, 40) || 'Track',
          params?.mood || 'Energetic',
          params?.genre || 'music'
        );
        if (coverImageUrl) setResult(prev => ({ ...prev, cover_image_url: coverImageUrl }));
      } catch (err) {
        console.warn('Cover art generation skipped:', err.message);
      }
      setGeneratingCover(false);
    }

    // Build list of all distinct audio URLs to save
    const allUrls = data.audio_urls?.length > 0
      ? data.audio_urls
      : [data.audio_url || data.output_url].filter(Boolean);

    for (let i = 0; i < allUrls.length; i++) {
      const title = i === 0
        ? (params?.title || currentPrompt.slice(0, 40) || 'Generated Track')
        : `${params?.title || currentPrompt.slice(0, 40) || 'Track'} (Take ${i + 1})`;
      await saveTrackToLibrary(allUrls[i], coverImageUrl, { ...params, title });
    }

    toast.success('✅ Auto-saved to library!');
  }, [saveTrackToLibrary]);

  const onError = useCallback((msg) => {
    setGenerating(false);
    toast.error(msg || 'Generation failed');
  }, []);

  const { status, progress } = useJobPolling(jobId, onComplete, onError);
  const isProcessing = generating || (jobId && status === 'processing');

  // Keyboard shortcut: ⌘+Enter to generate
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generate(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prompt, provider, selectedPersona]);

  const extendTrack = async () => {
    const audioUrl = result?.audio_url || result?.output_url;
    if (!audioUrl) return;
    setExtending(true);
    try {
      const res = await base44.functions.invoke('generateMusic', {
        provider: 'tempcolor',
        sound_prompt: `Continue and extend: ${aiParams?.sound_prompt || prompt}`,
        genre: aiParams?.genre || 'Pop',
        mood: aiParams?.mood || 'Energetic',
        duration: 60,
        model: 'TemPolor v4.6',
        tempolor_mode: 'instrumental',
        extend_audio_url: audioUrl,
      });
      const extUrl = res.data?.audio_url || res.data?.output_url;
      if (extUrl) {
        setResult(prev => ({ ...prev, extended_url: extUrl }));
        toast.success('Track extended!');
      } else {
        toast.error('Extension failed');
      }
    } catch (err) { toast.error(err.message); }
    setExtending(false);
  };

  const generate = async () => {
    if (!prompt.trim()) { toast.error('Enter a description for your track'); return; }
    setGenerating(true);
    setResult(null);
    setJobId('');
    setAiParams(null);
    savedRef.current = false; // reset guard for new generation

    try {
      // Step 1: AI determines all parameters — check cache first
      const cacheKey = `ai_params:${prompt.trim().toLowerCase()}:${selectedGenre}`;
      let aiDecision = cacheManager.get(cacheKey);

      if (!aiDecision) {
      aiDecision = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a music production AI. Given this track description: "${prompt}"${selectedGenre ? ` and the user-selected genre: "${selectedGenre}"` : ''}

        Return JSON with these fields:
        - genre: ${selectedGenre ? `"${selectedGenre}" (MUST match user selection, or hybrid like "Red Dirt Country")` : 'one of [Hip-Hop, Trap, EDM, House, Pop, R&B, Lo-Fi, Jazz, Rock, Country, Red Dirt Country, Afrobeats, Drill, Ambient, Indie]'}
        - mood: one of [Energetic, Chill, Dark, Happy, Sad, Uplifting, Aggressive, Romantic, Melancholic]
        - bpm: integer between 60-200 appropriate for the genre
        - duration: integer, one of [30, 60, 90, 120] in seconds
        - title: short creative track title (3-6 words)
        - sound_prompt: detailed music production description (instruments, feel, atmosphere)
        - needs_lyrics: boolean, true if the description implies vocal/song content`,
        response_json_schema: {
          type: 'object',
          properties: {
            genre: { type: 'string' },
            mood: { type: 'string' },
            bpm: { type: 'number' },
            duration: { type: 'number' },
            title: { type: 'string' },
            sound_prompt: { type: 'string' },
            needs_lyrics: { type: 'boolean' },
          }
        }
      });
        cacheManager.set(cacheKey, aiDecision, 600); // cache 10 min
      }

      setAiParams(aiDecision);
      aiParamsRef.current = aiDecision;
      promptRef.current = prompt;

      // Step 2: Generate lyrics if needed (vocal providers: sonic, nuro, tempcolor song mode, producer)
      let lyrics = '';
      if (aiDecision.needs_lyrics) {
        try {
          const lyricsRes = await base44.functions.invoke('generateLyrics', {
            topic: prompt,
            mood: aiDecision.mood,
            style: aiDecision.genre,
            length: 'medium',
          });
          lyrics = lyricsRes.data?.lyrics || '';
          if (lyrics) toast.success('🎤 Lyrics generated!');
        } catch { /* lyrics optional — provider will generate instrumentally */ }
      }

      // Step 3: Generate the music track
      const voiceId = selectedPersona !== 'auto' ? selectedPersona : undefined;
      // For Sonic: use the full user prompt as sound_prompt so genre nuance (e.g. "Red Dirt Texas
      // Country Rock Blues") is preserved — auto_lyrics mode reads this directly.
      const effectiveSoundPrompt = provider === 'sonic'
        ? `${prompt}. ${aiDecision.sound_prompt || ''}`.trim()
        : aiDecision.sound_prompt;

      const res = await base44.functions.invoke('generateMusic', {
        provider,
        duration: aiDecision.duration,
        genre: aiDecision.genre,
        mood: aiDecision.mood,
        tempo: aiDecision.bpm,
        sound_prompt: effectiveSoundPrompt,
        ...(lyrics && { lyrics }),
        ...(voiceId && { voice_persona_id: voiceId }),
        // sonic-v4-5 minimum — legacy models (v3-5, v4) have no vocal support
        ...(provider === 'sonic' && { model: 'sonic-v4-5' }),
        ...(provider === 'nuro' && { nuro_version: 'v1.0' }),
        ...(provider === 'tempcolor' && { model: 'TemPolor v4.6', tempolor_mode: aiDecision.needs_lyrics ? 'song' : 'instrumental' }),
      });

      if (res.data?.audio_url || res.data?.output_url) {
        setGenerating(false);
        await onComplete(res.data);
      } else if (res.data?.job_id) {
        setJobId(res.data.job_id);
        toast.success('Generation started — AI is composing…');
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
    const audioUrl = result?.audio_url || result?.output_url;
    if (!audioUrl) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: aiParams?.title || prompt.slice(0, 40),
        file_url: audioUrl,
        thumbnail_url: result.cover_image_url || '',
        is_public: false,
        metadata: {
          genre: aiParams?.genre,
          mood: aiParams?.mood,
          bpm: aiParams?.bpm || result.bpm,
          provider,
          duration: aiParams?.duration,
          ai_assisted: true,
          prompt,
        },
      });
      toast.success('Saved to library!');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const audioUrl = result?.audio_url || result?.output_url;

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">AI Model</p>
        <div className="flex gap-2 flex-wrap">
          {PROVIDERS.map(p => (
            <button key={p.value} onClick={() => setProvider(p.value)}
              className={`px-4 py-2 rounded-xl border text-sm font-bold transition-all flex items-center gap-1.5 ${provider === p.value ? 'border-blue-500 bg-blue-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-blue-500/40'}`}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Genre Selection */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Genre (Optional)</p>
        <ChipSelector
          chipType="genre"
          defaults={GENRE_OPTIONS}
          selected={selectedGenre}
          onSelect={setSelectedGenre}
          activeClass="bg-blue-600 text-white"
          allowAny
          anyLabel="Let AI Decide"
        />
        {selectedGenre && <p className="text-xs text-blue-300 mt-1.5">✓ AI will respect "{selectedGenre}" and tailor lyrics accordingly.</p>}
      </div>

      {/* Voice Persona Selection */}
      {voicePersonas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Voice</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSelectedPersona('auto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${selectedPersona === 'auto' ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              <Sparkles className="w-3 h-3" /> Best AI Voice
            </button>
            {voicePersonas.map(p => (
              <button key={p.id} onClick={() => setSelectedPersona(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${selectedPersona === p.id ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                <Mic2 className="w-3 h-3" /> {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Prompt */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-yellow-400" /> Describe Your Track
        </p>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. An upbeat summer pop anthem with catchy hooks and bright synthesizers…"
          rows={4}
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1.5">AI will determine genre, mood, BPM, key, lyrics and more automatically.</p>
      </div>

      {/* Quick Examples */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Examples</p>
        <div className="space-y-1.5">
          {QUICK_EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setPrompt(ex)}
              className="w-full text-left px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-xs text-muted-foreground transition-colors truncate">
              "{ex}"
            </button>
          ))}
        </div>
      </div>

      {/* AI Params Preview */}
      <AnimatePresence>
        {aiParams && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2">
            <p className="text-xs font-semibold text-purple-300 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> AI Decided:</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">{aiParams.genre}</Badge>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">{aiParams.mood}</Badge>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">{aiParams.bpm} BPM</Badge>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">{aiParams.duration}s</Badge>
              {aiParams.needs_lyrics
                ? <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-xs">🎤 Auto-lyrics on</Badge>
                : <Badge className="bg-muted text-muted-foreground border-border text-xs">🎼 Instrumental</Badge>}
            </div>
            {aiParams.title && <p className="text-xs text-purple-200 font-semibold">"{aiParams.title}"</p>}
            {aiParams.needs_lyrics && (
              <p className="text-xs text-pink-300/80 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                Lyrics auto-generated. For custom lyrics, use{' '}
                <Link to="/lyrics-studio" className="underline hover:text-pink-200">Lyrics Studio</Link>
                {' '}then paste into Advanced tab.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Button */}
      <Button onClick={generate} disabled={isProcessing || !prompt.trim()}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-bold text-base py-5 gap-2">
        <Zap className="w-5 h-5" />
        {isProcessing ? (jobId ? `AI Composing… ${progress}%` : 'AI Analyzing Prompt…') : '⚡ Quick Generate'}
      </Button>

      {/* Progress */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
              <p className="text-xs text-blue-300">AI is analyzing your prompt and composing your track…</p>
            </div>
            <div className="h-1.5 rounded-full bg-blue-500/20 overflow-hidden">
              <motion.div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress || 10}%` }} animate={{ width: `${progress || 10}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {audioUrl && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">Track Ready</span>
              {result?.bpm && <Badge variant="outline" className="text-xs">{result.bpm} BPM</Badge>}
              {result?.key && <Badge variant="outline" className="text-xs">{result.key}</Badge>}
            </div>

            {/* Cover Art — always shown after track completes */}
            <div className="flex items-start gap-4">
              {generatingCover ? (
                <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                </div>
              ) : result?.cover_image_url ? (
                <img src={result.cover_image_url} alt="Cover art" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-border" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                  <Image className="w-6 h-6 text-muted-foreground opacity-30" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Image className="w-3 h-3" />
                  {generatingCover ? 'Generating cover art…' : result?.cover_image_url ? 'Auto-generated cover art' : 'Cover art'}
                </p>
                <Link to="/cover-art-studio">
                  <Button variant="outline" size="sm" className="text-xs gap-1 rounded-lg">
                    <Palette className="w-3 h-3" /> Upgrade in Cover Art Studio
                  </Button>
                </Link>
              </div>
            </div>

            {/* Primary track */}
            <audio controls className="w-full rounded-xl" src={audioUrl} />

            {/* Additional Sonic tracks (track 2, 3...) */}
            {result?.audio_urls?.length > 1 && result.audio_urls.slice(1).map((url, i) => (
              <div key={url} className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold">🎵 Track {i + 2}</p>
                <audio controls className="w-full rounded-xl" src={url} />
              </div>
            ))}

            {result?.extended_url && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold">🎵 Extended Version</p>
                <audio controls className="w-full rounded-xl" src={result.extended_url} />
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={saveToLibrary} disabled={saving} className="flex-1 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold">
                <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save to Library'}
              </Button>
              <a href={audioUrl} download className="flex-1">
                <Button variant="outline" className="w-full gap-2 rounded-xl">
                  <Download className="w-4 h-4" /> Download
                </Button>
              </a>
              <MidiExportButton audioUrl={audioUrl} bpm={result?.bpm} musicalKey={result?.key} title={aiParams?.title || 'Track'} />
              <Button variant="outline" onClick={extendTrack} disabled={extending} className="gap-2 rounded-xl text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10">
                {extending ? <RotateCcw className="w-4 h-4 animate-spin" /> : <ChevronsRight className="w-4 h-4" />}
                {extending ? 'Extending…' : 'Extend'}
              </Button>
              <Button variant="outline" onClick={() => { setResult(null); setJobId(''); setAiParams(null); }} className="gap-2 rounded-xl">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}