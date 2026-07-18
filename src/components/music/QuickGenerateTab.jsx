import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Mic2, CheckCircle, Download, Save, RotateCcw, Sparkles, Image, Palette, ChevronsRight, AlertCircle, Info, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useJobPolling } from '@/hooks/useJobPolling';
import MidiExportButton from '@/components/music/MidiExportButton';
import { cacheManager } from '@/utils/cacheManager';
import ChipSelector from '@/components/music/ChipSelector';
import { routeProvider, PROVIDER_DETAILS } from '@/utils/providerRouter';
import { handleCreditError, refreshCreditsFromResponse, getProviderErrorMessage } from '@/utils/creditErrors';
import CostBadge from '@/components/credits/CostBadge';
import InfoTip from '@/components/common/InfoTip';
import { calculateHumanParticipationScore } from '@/utils/participationScore';

// Per-provider costs — must match backend CREDIT_COSTS in generateMusic.
// aimusicapi.ai spec: Sonic = 10 credits (returns 2 songs), Producer = 10 credits (1 song).
// Tempolor: 10 credits per song.
const PROVIDER_COSTS = { sonic: 10, tempcolor: 10, elevenlabs: 10 };

const ALL_PROVIDERS = [
  { value: 'sonic',      label: 'Sonic',      emoji: '🎵' },
  { value: 'tempcolor',  label: 'Tempolor',   emoji: '🎶' },
  { value: 'elevenlabs', label: 'ElevenLabs', emoji: '🎧' },
];

const QUICK_EXAMPLES = [
  'An upbeat summer pop anthem with catchy hooks and bright synths',
  'A dark, moody trap banger with heavy 808s and haunting melodies',
  'Chill lo-fi hip-hop perfect for late night studying',
  'An energetic EDM festival banger with a massive drop',
  'Smooth neo-soul R&B with soulful vocals and live bass',
];

const GENRE_OPTIONS = ['Hip-Hop', 'Trap', 'EDM', 'House', 'Pop', 'R&B', 'Lo-Fi', 'Jazz', 'Rock', 'Country', 'Red Dirt Country', 'Afrobeats', 'Drill', 'Ambient', 'Indie'];

export default function QuickGenerateTab({ initialPrompt = '', initialGenre = '', initialProvider = '' }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [providerOverride, setProviderOverride] = useState(initialProvider || null); // null = auto-routed
  const [routingDecision, setRoutingDecision] = useState(null);   // { provider, model, reason, routing_key }
  const [showProviderOverride, setShowProviderOverride] = useState(!!initialProvider);
  const [selectedGenre, setSelectedGenre] = useState(initialGenre);
  const [voicePersonas, setVoicePersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState('auto');
  // Derived: effective provider is the override (if set) or the auto-routed one
  const provider = providerOverride || routingDecision?.provider || 'sonic';
  const [generating, setGenerating] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [extending, setExtending] = useState(false);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [aiParams, setAiParams] = useState(null); // what AI decided
  const [lastError, setLastError] = useState(null); // persistent failure banner
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

  const saveTrackToLibrary = useCallback(async (audioUrl, coverImageUrl, params, contentHash) => {
    if (!audioUrl) return;
    try {
      const user = await base44.auth.me();

      // Apply ID3 tags silently — replace raw URL with tagged version
      // Now embeds USLT (lyrics frame), TLEN (duration), TMOO (mood), TKEY (key),
      // TPUB (publisher), TENC (encoded by) for full metadata recovery in any player.
      let finalUrl = audioUrl;
      try {
        const tagRes = await base44.functions.invoke('editID3Tags', {
          audio_url: audioUrl,
          cover_image_url: coverImageUrl || undefined,
          tags: {
            title: params?.title || prompt.slice(0, 60) || 'Generated Track',
            artist: user.full_name || 'BASE Station Artist',
            albumArtist: user.full_name || 'BASE Station Artist',
            album: 'BASE Station — AI Generated',
            genre: params?.genre || '',
            mood: params?.mood || '',
            bpm: params?.bpm || undefined,
            key: params?.key || undefined,
            duration: params?.duration || undefined,
            lyrics: params?.lyrics || undefined,
            year: new Date().getFullYear(),
            publisher: 'BASE Station',
            encodedBy: 'BASE Station AI',
            softwareUsed: `BASE Station (${provider}${params?.model ? ` ${params.model}` : ''})`,
            comment: `Generated by BASE Station using ${provider}${params?.model ? ` (${params.model})` : ''}`,
            copyright: `${new Date().getFullYear()} ${user.full_name || 'BASE Station'} — AI-Assisted`,
            txxx: {
              'BASE_PROVIDER': provider,
              'BASE_MODEL': params?.model || '',
              'BASE_MOOD': params?.mood || '',
              'BASE_TAGS': params?.tags || '',
              'BASE_VOCAL_GENDER': params?.vocal_gender || '',
              'BASE_VOCAL_TIMBRE': params?.vocal_timbre || '',
              'BASE_CONTENT_HASH': contentHash || '',
              'BASE_AI_ASSISTED': 'true',
              'BASE_SOUND_PROMPT': (params?.sound_prompt || '').slice(0, 500),
            },
          },
        });
        if (tagRes.data?.download_url) finalUrl = tagRes.data.download_url;
      } catch (tagErr) {
        console.warn('ID3 tagging skipped:', tagErr.message);
      }

      // Creative Ownership Score — Quick mode is AI-driven (auto lyrics, auto params)
      const participation = calculateHumanParticipationScore({
        userProvidedContent: false,
        prompt,
        styleOrTags: selectedGenre ? [selectedGenre] : [],
        personaOrTemplate: selectedPersona !== 'auto',
        isIteration: false,
      });

      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: params?.title || prompt.slice(0, 40) || 'Generated Track',
        file_url: finalUrl,
        thumbnail_url: coverImageUrl || '',
        is_public: false,
        ai_label: participation.label,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
        metadata: {
          genre: params?.genre,
          mood: params?.mood,
          bpm: params?.bpm,
          key: params?.key,
          duration: params?.duration,
          provider,
          model: params?.model || '',
          ai_assisted: true,
          prompt,
          sound_prompt: params?.sound_prompt || '',
          lyrics: params?.lyrics || '',
          tags: params?.tags || '',
          vocal_gender: params?.vocal_gender || '',
          vocal_timbre: params?.vocal_timbre || '',
          content_hash: contentHash || '',
          auto_saved: true,
          id3_tagged: finalUrl !== audioUrl,
        },
      });
    } catch (err) {
      console.warn('Auto-save failed:', err.message);
    }
  }, [prompt, provider, selectedGenre, selectedPersona]);

  // Use a ref so onComplete always has access to the latest aiParams even when called from polling
  const aiParamsRef = React.useRef(null);
  const promptRef = React.useRef('');
  const lyricsRef = React.useRef('');

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

    // Save only the primary track — never loop over all audio_urls to avoid mass API costs.
    // Merge provider-returned metadata (lyrics, title, duration, key, tags) with what we
    // captured locally. Provider lyrics win when our own ref is empty (auto-gen scenario).
    const primaryUrl = data.audio_url || data.output_url || data.audio_urls?.[0];
    if (primaryUrl) {
      const mergedLyrics = lyricsRef.current?.trim() ? lyricsRef.current : (data.lyrics || '');
      await saveTrackToLibrary(primaryUrl, coverImageUrl, {
        ...params,
        title: data.title || params?.title || currentPrompt.slice(0, 40) || 'Generated Track',
        genre: data.genre || params?.genre,
        mood: data.mood || params?.mood,
        bpm: data.bpm || params?.bpm,
        key: data.key || params?.key,
        duration: data.duration || params?.duration,
        lyrics: mergedLyrics,
        tags: data.tags || '',
        vocal_gender: data.vocal_gender || '',
        vocal_timbre: data.vocal_timbre || '',
        sound_prompt: params?.sound_prompt || '',
        model: data.model_version || params?.model || '',
      }, data.content_hash || null);
      // Reflect lyrics back into UI state so user can see them in the result card
      if (mergedLyrics && !lyricsRef.current) {
        lyricsRef.current = mergedLyrics;
        setResult(prev => ({ ...prev, lyrics: mergedLyrics }));
      }
      toast.success('✅ Auto-saved to library with full metadata!');
    }
  }, [saveTrackToLibrary]);

  const onError = useCallback((msg) => {
    setGenerating(false);
    setLastError({ type: 'error', message: msg || 'Generation failed' });
    toast.error(msg || 'Generation failed');
  }, []);

  const { status, progress } = useJobPolling(jobId, onComplete, onError);
  const isProcessing = generating || (jobId && (status === 'processing' || status === 'pending'));

  // Keyboard shortcut: ⌘+Enter — use ref to avoid re-registering on every keystroke
  const generateRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generateRef.current?.(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
    if (generating || (jobId && status === 'processing')) return; // hard guard against double-fire
    setGenerating(true);
    setResult(null);
    setJobId('');
    setAiParams(null);
    setRoutingDecision(null);
    setLastError(null);
    savedRef.current = false;

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

      // Step 2: Auto-route provider (unless user manually overrode)
      const routing = providerOverride
        ? { provider: providerOverride, model: PROVIDER_DETAILS[providerOverride]?.model, reason: 'Manually selected by user.', routing_key: 'manual_override', fallbackChain: [] }
        : routeProvider({
            duration: aiDecision.duration,
            needs_lyrics: aiDecision.needs_lyrics,
            genre: aiDecision.genre,
            mood: aiDecision.mood,
          });
      setRoutingDecision(routing);

      // Step 3: Generate lyrics if needed
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
          lyricsRef.current = lyrics;
          if (lyrics) {
            toast.success('🎤 Lyrics generated!');
            refreshCreditsFromResponse(lyricsRes.data);
          }
        } catch (lyricsErr) {
          // If lyrics gen failed due to insufficient credits, surface it and stop the whole flow
          if (handleCreditError(lyricsErr)) {
            setGenerating(false);
            throw lyricsErr;
          }
          /* otherwise lyrics are optional — continue without */
        }
      }

      // Step 4: Generate track — try primary provider, then fallback chain on failure
      const effectiveProvider = routing.provider;
      const effectiveSoundPrompt = effectiveProvider === 'sonic'
        ? `${prompt}. ${aiDecision.sound_prompt || ''}`.trim()
        : aiDecision.sound_prompt;

      const musicParams = {
        provider: effectiveProvider,
        duration: aiDecision.duration,
        genre: aiDecision.genre,
        mood: aiDecision.mood,
        tempo: aiDecision.bpm,
        sound_prompt: effectiveSoundPrompt,
        routing_reason: routing.routing_key,
        ...(lyrics && { lyrics }),
        ...(selectedPersona !== 'auto' && { voice_persona_id: selectedPersona }),
        ...(effectiveProvider === 'sonic' && { model: routing.model || 'sonic-v4-5-plus' }),
        ...(effectiveProvider === 'tempcolor' && { model: routing.model || 'TemPolor v4.6', tempolor_mode: routing.tempolor_mode || (aiDecision.needs_lyrics ? 'song' : 'instrumental') }),
      };

      let res;
      try {
        res = await base44.functions.invoke('generateMusic', musicParams);
      } catch (primaryErr) {
        // Fallback chain
        const fallbacks = routing.fallbackChain || [];
        let fell = false;
        for (const fallbackProvider of fallbacks) {
          try {
            toast(`⚠ ${PROVIDER_DETAILS[effectiveProvider]?.label} failed — trying ${PROVIDER_DETAILS[fallbackProvider]?.label}…`);
            res = await base44.functions.invoke('generateMusic', { ...musicParams, provider: fallbackProvider, routing_reason: `fallback_from_${effectiveProvider}` });
            fell = true;
            break;
          } catch { continue; }
        }
        if (!fell) throw primaryErr;
      }

      if (res.data?.audio_url || res.data?.output_url) {
        setGenerating(false);
        refreshCreditsFromResponse(res.data);
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
      const status = err?.response?.status;
      const data = err?.response?.data;
      // Only flag as user credit issue when our own backend says so (not upstream provider 402)
      const isCredits = data?.error === 'Insufficient credits' && !data?.provider_status;
      // Prefer the friendly aimusicapi.ai spec-mapped message when available
      const friendly = getProviderErrorMessage(err);
      const msg = friendly || data?.message || err.message || 'Generation failed';
      setLastError({
        type: isCredits ? 'credits' : 'error',
        message: msg,
        required: data?.required,
        balance: data?.balance,
      });
      if (!handleCreditError(err)) toast.error(msg);
    }
  };

  // Keep ref in sync so keyboard shortcut always calls the latest generate
  generateRef.current = generate;

  const saveToLibrary = async () => {
    const audioUrl = result?.audio_url || result?.output_url;
    if (!audioUrl) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      // Use the SAME complete metadata payload as auto-save so lyrics, model,
      // content_hash, clip_id, etc. are preserved on manually-saved tracks too.
      const mergedLyrics = lyricsRef.current?.trim() ? lyricsRef.current : (result?.lyrics || '');
      const participation = calculateHumanParticipationScore({
        userProvidedContent: false,
        prompt,
        styleOrTags: selectedGenre ? [selectedGenre] : [],
        personaOrTemplate: selectedPersona !== 'auto',
        isIteration: false,
      });
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: result?.title || aiParams?.title || prompt.slice(0, 40),
        file_url: audioUrl,
        thumbnail_url: result.cover_image_url || '',
        is_public: false,
        ai_label: participation.label,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
        metadata: {
          genre: result?.genre || aiParams?.genre,
          mood: result?.mood || aiParams?.mood,
          bpm: result?.bpm || aiParams?.bpm,
          key: result?.key,
          duration: result?.duration || aiParams?.duration,
          provider,
          model: result?.model_version || aiParams?.model || '',
          ai_assisted: true,
          prompt,
          sound_prompt: aiParams?.sound_prompt || '',
          lyrics: mergedLyrics,
          tags: result?.tags || '',
          vocal_gender: result?.vocal_gender || '',
          vocal_timbre: result?.vocal_timbre || '',
          content_hash: result?.content_hash || '',
          clip_id: result?.clip_id || '',
          wav_url: result?.wav_url || '',
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
      {/* Provider — Auto-Routed with manual override */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            AI Provider
            <InfoTip text="Auto-routing picks the best provider based on your prompt: Sonic for vocals, Tempolor for genre fidelity and instrumentals (incl. Lyria 3 Pro). Override only if you have a strong preference." />
          </p>
          <button onClick={() => { setShowProviderOverride(p => !p); setProviderOverride(null); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showProviderOverride ? 'Use Auto-Route' : '⚙ Override'}
            <ChevronDown className={`w-3 h-3 transition-transform ${showProviderOverride ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Auto-route badge — shown when not overriding */}
        {!showProviderOverride && (
          <div className="flex items-center gap-2 flex-wrap">
            {routingDecision ? (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${PROVIDER_DETAILS[routingDecision.provider]?.color || 'border-border bg-card text-foreground'}`}>
                <span>{PROVIDER_DETAILS[routingDecision.provider]?.emoji} {PROVIDER_DETAILS[routingDecision.provider]?.label}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono opacity-80">{routingDecision.model}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3" /> Auto-selected after prompt analysis
              </div>
            )}
            {routingDecision?.reason && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="w-3 h-3 flex-shrink-0" />
                <span>{routingDecision.reason}</span>
              </div>
            )}
          </div>
        )}

        {/* Manual override grid */}
        <AnimatePresence>
          {showProviderOverride && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="flex gap-2 flex-wrap mt-2">
                {ALL_PROVIDERS.map(p => (
                  <button key={p.value} onClick={() => setProviderOverride(p.value)}
                    className={`px-4 py-2 rounded-xl border text-sm font-bold transition-all flex items-center gap-1.5 ${providerOverride === p.value ? 'border-blue-500 bg-blue-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-blue-500/40'}`}>
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
              {providerOverride && <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Auto-routing disabled — using {PROVIDER_DETAILS[providerOverride]?.label} for all generations.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Genre Selection */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Genre (Optional)
          <InfoTip text="Picking a genre locks the AI to that style. Leave blank to let the AI choose based on your prompt." />
        </p>
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
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            Voice
            <InfoTip text="Pick a saved Voice Persona for consistent artist identity across tracks. Or let the AI choose the best fit for your prompt." />
          </p>
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
          <InfoTip text="Describe instruments + atmosphere, not just genre. '808 sub, brushed snare, distant choir, late-night intimate' beats 'trap beat'. Stay under ~400 chars — longer prompts confuse the model." />
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

      {/* Persistent error banner — survives toast dismissal so users always see why generation stopped */}
      <AnimatePresence>
        {lastError && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className={`p-4 rounded-xl border flex items-start gap-3 ${lastError.type === 'credits' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${lastError.type === 'credits' ? 'text-amber-400' : 'text-red-400'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold mb-0.5 ${lastError.type === 'credits' ? 'text-amber-300' : 'text-red-300'}`}>
                {lastError.type === 'credits' ? 'Out of Credits' : 'Generation Failed'}
              </p>
              <p className="text-xs text-muted-foreground">{lastError.message}</p>
              {lastError.type === 'credits' && (lastError.required != null || lastError.balance != null) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Required: <span className="font-semibold text-foreground">{lastError.required ?? '?'}</span> · Your balance: <span className="font-semibold text-foreground">{lastError.balance ?? '?'}</span>
                </p>
              )}
              {lastError.type === 'credits' && (
                <p className="text-xs text-amber-200/80 mt-2">
                  💡 Buy a one-time credit pack or upgrade to a monthly plan for the best per-track value.
                </p>
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                {lastError.type === 'credits' && (
                  <>
                    <Link to="/credits">
                      <Button size="sm" className="rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">Buy Credits</Button>
                    </Link>
                    <Link to="/credits?tab=subscriptions">
                      <Button size="sm" variant="outline" className="rounded-lg text-xs border-amber-500/50 text-amber-300 hover:bg-amber-500/10">Upgrade Plan</Button>
                    </Link>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => setLastError(null)} className="rounded-lg text-xs">Dismiss</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Button — wrapped so empty-prompt clicks still show feedback */}
      <div onClick={() => { if (!prompt.trim() && !isProcessing) toast.error('Enter a description for your track first.'); }}>
        <Button onClick={generate} disabled={isProcessing || !prompt.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-bold text-base py-5 gap-2">
          <Zap className="w-5 h-5" />
          {isProcessing ? (jobId ? `AI Composing… ${progress}%` : 'AI Analyzing Prompt…') : '⚡ Quick Generate'}
          {!isProcessing && <CostBadge cost={(PROVIDER_COSTS[provider] || 5) + 2} />}
        </Button>
      </div>
      {!prompt.trim() && !isProcessing && (
        <p className="text-xs text-amber-400/80 -mt-3 flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3" /> Enter a description or pick an example below to enable Generate.
        </p>
      )}

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

            {/* Lyrics preview — shows provider-returned or AI-generated lyrics */}
            {(result?.lyrics || lyricsRef.current) && (
              <details className="rounded-xl bg-muted/50 border border-border overflow-hidden">
                <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-2">
                  <Mic2 className="w-3.5 h-3.5 text-pink-400" /> Lyrics (embedded in ID3 tags)
                </summary>
                <pre className="px-4 py-3 text-xs text-muted-foreground whitespace-pre-wrap font-sans max-h-72 overflow-y-auto border-t border-border">
                  {result?.lyrics || lyricsRef.current}
                </pre>
              </details>
            )}

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