import { useState, useCallback, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Save, Download, RotateCcw, CheckCircle, Sparkles, Mic2, Image, Palette, Music2, ChevronsRight, AlertCircle, Type
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useJobPolling } from '@/hooks/useJobPolling';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import MidiExportButton from '@/components/music/MidiExportButton';
import MasterDownloadButtons from '@/components/music/MasterDownloadButtons';
import ChipSelector from '@/components/music/ChipSelector';
import QuickErrorBanner from '@/components/music/quick/QuickErrorBanner';
import ModelFamilySelect from '@/components/music/ModelFamilySelect';
import SonicStyleControls from '@/components/music/SonicStyleControls';
import { sonicGenerationCost } from '@/config/musicModelCatalog';
import MastersBriefDisplay from '@/components/songwriting/MastersBriefDisplay';
import SaveMastersReportButton from '@/components/songwriting/SaveMastersReportButton';
import { Crown } from 'lucide-react';
import { handleCreditError, refreshCreditsFromResponse, getProviderErrorMessage } from '@/utils/creditErrors';
import CostBadge from '@/components/credits/CostBadge';
import LyricsCompatibilityCheck from '@/components/music/LyricsCompatibilityCheck';
import SavedLyricsPicker from '@/components/music/SavedLyricsPicker';
import { loadLyricAssetText } from '@/lib/music/lyricAssetText';
import { getLyricsSpec } from '@/config/modelLyricsSpec';
import { calculateHumanParticipationScore } from '@/utils/participationScore';
import { providerLabel } from '@/utils/providerRouter';
import {
  SONIC_FAMILIES,
  TEMPOLOR_SONG_FAMILIES,
  TEMPOLOR_INSTRUMENTAL_FAMILIES,
  DEFAULT_SONIC_MODEL,
} from '@/config/musicModelCatalog';

// Per-provider costs — must match backend CREDIT_COSTS in generateMusic.
// Sonic is priced per model via sonicGenerationCost (14 advanced / 10 standard).
const PROVIDER_COSTS = { tempcolor: 10, elevenlabs: 10 };

const PROVIDERS = [
  { value: 'sonic',      label: 'Sonic',      desc: 'Generates 2 tracks + cover art', color: 'border-cyan-500 bg-cyan-500/10' },
  { value: 'tempcolor',  label: 'Tempolor',   desc: 'TemPolor, Mureka, MiniMax & Lyria models', color: 'border-amber-500 bg-amber-500/10' },
  // ElevenLabs lives in the Eleven Music tab alongside My Sound — both run on
  // ElevenLabs only, so keeping a duplicate provider button here was redundant.
];

// Model catalog is shared with Quick Generate — see src/config/musicModelCatalog.js


const GENRE_CHIPS = ['Hip-Hop', 'Trap', 'EDM', 'House', 'Pop', 'R&B', 'Lo-Fi', 'Jazz', 'Rock', 'Afrobeats', 'Drill', 'Ambient'];
const MOOD_CHIPS = ['Energetic', 'Chill', 'Dark', 'Happy', 'Sad', 'Uplifting', 'Aggressive', 'Romantic', 'Melancholic'];
const DURATIONS = [15, 30, 60, 90, 120, 180, 240, 300];

const PROMPT_TEMPLATES = [
  { label: '🔥 Trap Banger', prompt: 'Hard-hitting 808s, hi-hat rolls, melodic vocal chops, dark atmosphere' },
  { label: '🌊 Lo-Fi Study', prompt: 'Warm vinyl crackle, mellow piano, slow jazz drums, cozy late-night vibe' },
  { label: '⚡ EDM Drop', prompt: 'Building tension, massive synth drop, festival crowd energy, euphoric leads' },
  { label: '🎷 Neo Soul', prompt: 'Soulful Rhodes piano, live bass groove, lush harmonies, smooth R&B feel' },
  { label: '🌙 Chill R&B', prompt: 'Soft drum machine, warm pads, falsetto vibes, late-night feels' },
  { label: '🎸 Indie Rock', prompt: 'Distorted guitar riffs, driving drums, anthemic chorus, raw energy' },
  { label: '🤠 Country', prompt: 'Acoustic guitar strumming, pedal steel, warm fiddle, heartfelt storytelling, backroad twang' },
  { label: '🎺 Blues', prompt: 'Gritty electric guitar bends, shuffle drums, walking bass, smoky barroom soul' },
  { label: '🎤 Pop Anthem', prompt: 'Bright punchy synths, catchy hook-driven chorus, polished radio-ready production' },
  { label: '🪕 Red Dirt', prompt: 'Raw twangy Telecaster, driving country-rock drums, honest outlaw grit, live-band feel' },
  { label: '🎻 Cinematic', prompt: 'Sweeping strings, epic percussion swells, emotional builds, film-score grandeur' },
  { label: '🏝️ Reggae', prompt: 'Laid-back skank guitar, deep dub bass, one-drop drums, sunny island groove' },
];

import TrainingFeedback from '@/components/training/TrainingFeedback';
import { useTrainingTelemetry } from '@/hooks/useTrainingTelemetry';

export default function AdvancedGenerateTab({ initialLyricsAssetId = '', initialGenre = '', initialTopic = '' }) {
  const { sampleId, logGeneration, markRegenerated } = useTrainingTelemetry();
  const [provider, setProvider] = useState('sonic');
  const [importedFromStudio, setImportedFromStudio] = useState(false);
  const [sonicModel, setSonicModel] = useState(DEFAULT_SONIC_MODEL);
  // Sonic steering — vocal_gender / instrumental / negative_tags / style_weight / weirdness_constraint
  const [sonicStyle, setSonicStyle] = useState({});
  const [temporlorMode, setTemporlorMode] = useState('song');
  const [temporlorModel, setTemporlorModel] = useState('tempolor-latest');
  const [duration, setDuration] = useState(null); // null = "Any" (let provider decide)
  const [genre, setGenre] = useState(initialGenre || 'Hip-Hop');
  const [mood, setMood] = useState('Energetic');
  const [tempo, setTempo] = useState('120');
  const [customTitle, setCustomTitle] = useState('');
  const [soundPrompt, setSoundPrompt] = useState(initialTopic || '');
  const [lyrics, setLyrics] = useState('');
  const [lyricsMode, setLyricsMode] = useState('none'); // 'none' | 'custom' | 'generate' | 'saved'
  const [savedLyrics, setSavedLyrics] = useState([]);
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [voicePersonas, setVoicePersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState('none');
  const [generating, setGenerating] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [extending, setExtending] = useState(false);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAssetId, setSavedAssetId] = useState(null);
  const [lastError, setLastError] = useState(null); // persistent failure banner
  const [mastersBrief, setMastersBrief] = useState(null); // 243 Masters brief imported from Lyrics Studio
  const [runningMasters, setRunningMasters] = useState(false);
  const savedRef = useRef(false); // prevent duplicate auto-saves

  // Debounced lyrics — the compatibility check re-runs on every keystroke otherwise
  const debouncedLyrics = useDebouncedValue(lyrics, 200);

  useEffect(() => {
    base44.auth.me().then(user => {
      Promise.all([
        base44.entities.VoicePersona.filter({ user_id: user.id }, '-created_date', 10),
        base44.entities.UserAsset.filter({ user_id: user.id, asset_type: 'lyric' }, '-created_date', 20),
      ]).then(([personas, lyricAssets]) => {
        setVoicePersonas(personas);
        setSavedLyrics(lyricAssets);
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Import lyrics from Lyrics Studio via ?lyrics=<assetId>
  useEffect(() => {
    if (!initialLyricsAssetId) return;
    (async () => {
      try {
        const asset = await base44.entities.UserAsset.get(initialLyricsAssetId);
        const text = await loadLyricAssetText(asset);
        if (text) {
          setLyrics(text);
          setLyricsMode('custom');
          setImportedFromStudio(true);
          toast.success('🎤 Lyrics imported from Lyrics Studio');
        }
        // 243 Masters brief — if present on the asset, surface it + prefill the sound prompt
        const meta = asset?.metadata || {};
        if (meta.masters_brief) {
          setMastersBrief({
            title: asset.title,
            key: meta.masters_key,
            bpm: meta.masters_bpm,
            chord_progression: meta.masters_chord_progression || [],
            arrangement: meta.masters_arrangement || [],
            production_brief: meta.masters_brief,
            masters_used: meta.masters_used || [],
          });
          setSoundPrompt(prev => prev || meta.masters_brief);
          if (meta.masters_bpm) setTempo(String(meta.masters_bpm));
          toast.success('👑 243 Masters brief loaded — production prompt prefilled');
        }
      } catch {
        toast.error('Could not load lyrics from your library');
      }
    })();
  }, [initialLyricsAssetId]);

  const generateCoverArtUrl = async (title, moodVal, genreVal) => {
    try {
      const coverRes = await base44.integrations.Core.GenerateImage({
        prompt: `Music album cover artwork. Style: ${genreVal}. Mood: ${moodVal}. Visual theme matching "${title}". Bold typography, dramatic lighting, professional music industry aesthetic. No text overlays.`,
      });
      return coverRes.url || null;
    } catch { return null; }
  };

  const saveTrackToLibrary = useCallback(async (audioUrl, coverImageUrl, titleOverride, extraMeta) => {
    if (!audioUrl) return;
    try {
      const user = await base44.auth.me();

      // Creative Ownership Score — how much human input shaped this track
      const participation = await calculateHumanParticipationScore({
        userProvidedContent: (lyricsMode === 'custom' || lyricsMode === 'saved') && !!extraMeta?.lyrics?.trim(),
        prompt: extraMeta?.sound_prompt || '',
        styleOrTags: [genre, mood].filter(Boolean),
        personaOrTemplate: selectedPersona !== 'none' || !!mastersBrief,
        isIteration: false,
      });

      // Apply ID3 tags silently — replace raw URL with fully tagged version
      // Now embeds USLT (lyrics frame), TLEN (duration), TMOO (mood), TKEY (key) +
      // TXXX provenance frames so the file is fully self-describing in any player.
      let finalUrl = audioUrl;
      try {
        const tagRes = await base44.functions.invoke('editID3Tags', {
          audio_url: audioUrl,
          cover_image_url: coverImageUrl || undefined,
          tags: {
            title: extraMeta?.title || titleOverride || `${mood} ${genre}`,
            artist: user.full_name || 'BASE Station Artist',
            albumArtist: user.full_name || 'BASE Station Artist',
            album: 'BASE Station — AI Generated',
            genre,
            mood,
            bpm: extraMeta?.bpm || undefined,
            key: extraMeta?.key || undefined,
            duration: extraMeta?.duration || undefined,
            lyrics: extraMeta?.lyrics || undefined,
            year: new Date().getFullYear(),
            publisher: 'BASE Station',
            encodedBy: 'BASE Station AI',
            softwareUsed: `BASE Station (${providerLabel(provider)}${extraMeta?.model ? ` ${extraMeta.model}` : ''})`,
            comment: `Generated by BASE Station using ${providerLabel(provider)}${extraMeta?.model ? ` (${extraMeta.model})` : ''}`,
            copyright: `${new Date().getFullYear()} ${user.full_name || 'BASE Station'} — AI-Assisted`,
            txxx: {
              'BASE_PROVIDER': provider,
              'BASE_MODEL': extraMeta?.model || '',
              'BASE_MOOD': mood,
              'BASE_GENRE': genre,
              'BASE_TAGS': extraMeta?.tags || '',
              'BASE_VOCAL_GENDER': extraMeta?.vocal_gender || '',
              'BASE_VOCAL_TIMBRE': extraMeta?.vocal_timbre || '',
              'BASE_CONTENT_HASH': extraMeta?.content_hash || '',
              'BASE_AI_ASSISTED': 'true',
              'BASE_SOUND_PROMPT': (extraMeta?.sound_prompt || '').slice(0, 500),
            },
          },
        });
        if (tagRes.data?.download_url) finalUrl = tagRes.data.download_url;
      } catch (tagErr) {
        console.warn('ID3 tagging skipped:', tagErr.message);
      }

      return await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: extraMeta?.title || titleOverride || `${mood} ${genre} — ${providerLabel(provider)}`,
        file_url: finalUrl,
        thumbnail_url: coverImageUrl || '',
        is_public: false,
        ai_label: participation.label,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
        ddex_ai_metadata: participation.ddex,
        metadata: {
          genre, mood, tempo, provider,
          model: extraMeta?.model || '',
          bpm: extraMeta?.bpm || undefined,
          key: extraMeta?.key || undefined,
          duration: extraMeta?.duration || duration || undefined,
          lyrics: extraMeta?.lyrics || '',
          tags: extraMeta?.tags || '',
          vocal_gender: extraMeta?.vocal_gender || '',
          vocal_timbre: extraMeta?.vocal_timbre || '',
          content_hash: extraMeta?.content_hash || '',
          sound_prompt: extraMeta?.sound_prompt || '',
          // Lossless master — the BASE Mark cascade marks this file, not the MP3.
          wav_url: extraMeta?.wav_url || '',
          clip_id: extraMeta?.clip_id || '',
          auto_saved: true,
          id3_tagged: finalUrl !== audioUrl,
          ...(mastersBrief && {
            masters_report: true,
            masters_brief: mastersBrief.production_brief,
            masters_key: mastersBrief.key,
            masters_bpm: mastersBrief.bpm,
            masters_chord_progression: mastersBrief.chord_progression,
            masters_arrangement: mastersBrief.arrangement,
            masters_used: mastersBrief.masters_used,
          }),
        },
      });
    } catch (err) {
      console.warn('Auto-save failed:', err.message);
      return null;
    }
  }, [mood, genre, provider, tempo, duration, mastersBrief, lyricsMode, selectedPersona]);

  const onComplete = useCallback(async (data) => {
    if (savedRef.current) return; // prevent duplicate calls
    savedRef.current = true;
    setGenerating(false);
    setResult(data);
    toast.success(data?.audio_urls?.length > 1 ? `🎵 ${data.audio_urls.length} tracks ready!` : '🎵 Track ready!');

    // Always generate cover art for every track
    let coverImageUrl = data.cover_image_url || null;
    if (!coverImageUrl) {
      setGeneratingCover(true); // show spinner immediately
      coverImageUrl = await generateCoverArtUrl(`${mood} ${genre} Track`, mood, genre);
      setGeneratingCover(false);
      if (coverImageUrl) setResult(prev => ({ ...prev, cover_image_url: coverImageUrl }));
    }

    // Save only the primary track — never loop over all audio_urls to avoid mass API costs.
    // Merge provider-returned lyrics/title/duration/tags with locally captured params so
    // tracks generated with auto-lyrics (Sonic/Nuro) still get full ID3 + library metadata.
    const primaryUrl = data.audio_url || data.output_url || data.audio_urls?.[0];
    if (primaryUrl) {
      const mergedLyrics = lyrics?.trim() ? lyrics : (data.lyrics || '');
      const resolvedTitle = customTitle.trim() || `${mood} ${genre} — ${providerLabel(provider)}`;
      const savedAsset = await saveTrackToLibrary(primaryUrl, coverImageUrl, resolvedTitle, {
        wav_url: data.wav_url || '',
        clip_id: data.clip_id || '',
        title: customTitle.trim() || data.title || resolvedTitle,
        bpm: data.bpm,
        key: data.key,
        duration: data.duration || duration,
        lyrics: mergedLyrics,
        tags: data.tags || '',
        vocal_gender: data.vocal_gender || '',
        vocal_timbre: data.vocal_timbre || '',
        sound_prompt: soundPrompt || '',
        content_hash: data.content_hash || null,
        model: data.model_version || (provider === 'sonic' ? sonicModel : temporlorModel),
      });
      if (savedAsset?.id) setSavedAssetId(savedAsset.id);
      // Opt-in telemetry — same shape as Harmonix, so results are comparable
      // across providers rather than siloed per tab.
      logGeneration({
        provider,
        model: data.model_version || (provider === 'sonic' ? sonicModel : temporlorModel),
        prompt: soundPrompt || '',
        lyrics: mergedLyrics,
        genre, mood,
        duration: data.duration || duration,
        used_masters_engine: !!mastersBrief,
        outcome: savedAsset?.id ? 'saved' : 'generated',
        asset_id: savedAsset?.id || '',
      });
      // Reflect provider-returned lyrics into UI so user can see them
      if (mergedLyrics && !lyrics?.trim()) {
        setLyrics(mergedLyrics);
        setLyricsMode('custom');
        setResult(prev => ({ ...prev, lyrics: mergedLyrics }));
      }
      toast.success('✅ Auto-saved to library with full metadata!');
    }
  }, [mood, genre, provider, saveTrackToLibrary, lyrics, soundPrompt, duration, sonicModel, temporlorModel, mastersBrief, customTitle, logGeneration]);

  const onError = useCallback((msg) => {
    setGenerating(false);
    setLastError({ type: 'error', message: msg || 'Generation failed' });
    toast.error(msg || 'Generation failed');
  }, []);

  const { status, progress } = useJobPolling(jobId, onComplete, onError);
  const isProcessing = generating || (jobId && (status === 'processing' || status === 'pending'));

  // Keyboard shortcut: ⌘+Enter to generate — use ref to avoid re-registering on every keystroke
  const generateRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generateRef.current?.(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // register once only

  const extendTrack = async () => {
    const audioUrl = result?.audio_url || result?.output_url;
    if (!audioUrl) return;
    setExtending(true);
    try {
      const res = await base44.functions.invoke('generateMusic', {
        provider: 'tempcolor',
        sound_prompt: `Continue and extend: ${soundPrompt || `${mood} ${genre} track`}`,
        genre, mood, duration: 60,
        model: temporlorMode === 'instrumental' ? 'TemPolor i4' : 'tempolor-latest',
        tempolor_mode: temporlorMode,
        extend_audio_url: audioUrl,
      });
      const extUrl = res.data?.audio_url || res.data?.output_url;
      if (extUrl) {
        setResult(prev => ({ ...prev, extended_url: extUrl }));
        toast.success('Track extended!');
      } else { toast.error('Extension failed'); }
    } catch (err) { toast.error(err.message); }
    setExtending(false);
  };

  // Current model per provider — drives lyric char budgets + compatibility checks
  const activeModel = provider === 'sonic' ? sonicModel : temporlorModel;
  const activeLyricsMax = getLyricsSpec(provider, activeModel).maxLyricsChars;

  const runMastersEngine = async () => {
    if (!soundPrompt && !genre) { toast.error('Add a sound description or genre first'); return; }
    setRunningMasters(true);
    try {
      const res = await base44.functions.invoke('generate243Masters', {
        topic: soundPrompt || `${mood} ${genre} track`,
        genre, mood,
        bpm: tempo ? Number(tempo) : undefined,
        // Model-aware budget so Masters lyrics never exceed the selected gen model's limit
        max_chars: activeLyricsMax,
      });
      const data = res.data;
      if (data?.error) { toast.error(data.error); setRunningMasters(false); return; }
      setMastersBrief(data);
      // Push production brief into the sound prompt + lyrics into the lyrics field
      if (data.production_brief) setSoundPrompt(data.production_brief);
      if (data.lyrics) { setLyrics(data.lyrics); setLyricsMode('custom'); }
      if (data.bpm) setTempo(String(data.bpm));
      refreshCreditsFromResponse(data);
      toast.success('👑 243 Masters brief ready — chord chart + arrangement + prompt loaded');
    } catch (err) {
      if (!handleCreditError(err)) toast.error(err?.response?.data?.message || err.message);
    }
    setRunningMasters(false);
  };

  const generateLyricsAI = async () => {
    setGeneratingLyrics(true);
    try {
      const res = await base44.functions.invoke('generateLyrics', {
        topic: soundPrompt || `${mood} ${genre} track`,
        mood,
        style: genre,
        length: 'medium',
        // Model-aware char budget — keeps output within the selected gen model's lyric limit
        max_chars: activeLyricsMax,
      });
      setLyrics(res.data?.lyrics || '');
      refreshCreditsFromResponse(res.data);
      toast.success('Lyrics generated!');
    } catch (err) {
      if (!handleCreditError(err)) toast.error(err?.response?.data?.message || err.message);
    }
    setGeneratingLyrics(false);
  };

  const generate = async () => {
    if (generating || (jobId && status === 'processing')) return; // hard guard against double-fire
    setGenerating(true);
    setResult(null);
    setJobId('');
    setSavedAssetId(null);
    setLastError(null);
    savedRef.current = false; // reset guard for new generation
    markRegenerated();
    // Read latest values directly from state refs to avoid stale closure issues
    const currentPrompt = soundPrompt;
    const currentLyrics = lyrics;
    try {
      const res = await base44.functions.invoke('generateMusic', {
        provider,
        ...(duration && { duration }),
        genre, mood,
        tempo: parseInt(tempo, 10) || 120,
        title: customTitle.trim() || `${mood} ${genre} — ${providerLabel(provider)}`,
        sound_prompt: currentPrompt || `${mood} ${genre} track`,
        ...(currentLyrics && lyricsMode !== 'none' && { lyrics: currentLyrics }),
        ...(selectedPersona !== 'none' && { voice_persona_id: selectedPersona }),
        ...(provider === 'sonic' && {
          model: sonicModel,
          ...(sonicStyle.instrumental && { instrumental: true }),
          ...(sonicStyle.vocal_gender && { vocal_gender: sonicStyle.vocal_gender }),
          ...(sonicStyle.negative_tags?.trim() && { negative_tags: sonicStyle.negative_tags.trim() }),
          ...(typeof sonicStyle.style_weight === 'number' && { style_weight: sonicStyle.style_weight }),
          ...(typeof sonicStyle.weirdness_constraint === 'number' && { weirdness_constraint: sonicStyle.weirdness_constraint }),
        }),
        ...(provider === 'tempcolor' && { model: temporlorModel, tempolor_mode: temporlorMode }),
      });

      if (res.data?.audio_url || res.data?.output_url) {
        setGenerating(false);
        refreshCreditsFromResponse(res.data);
        await onComplete(res.data);
      } else if (res.data?.job_id) {
        setJobId(res.data.job_id);
        toast.success('Generation started — polling for result…');
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

  // Keep ref in sync so the keyboard shortcut always calls the latest generate
  generateRef.current = generate;

  // Manual save — routes through the SAME builder the auto-save uses so a
  // hand-saved track keeps its ID3 tags, lyrics, COS score and model metadata.
  // Divergent copies of this payload were how manually-saved tracks lost their
  // provenance fields.
  const saveToLibrary = async () => {
    const audioUrl = result?.audio_url || result?.output_url;
    if (!audioUrl || savedAssetId) return;
    setSaving(true);
    const asset = await saveTrackToLibrary(
      audioUrl,
      result?.cover_image_url || '',
      customTitle.trim() || result?.title || `${mood} ${genre} — ${providerLabel(provider)}`,
      {
        title: customTitle.trim() || result?.title || '',
        bpm: result?.bpm,
        key: result?.key,
        duration: result?.duration || duration,
        lyrics: lyrics?.trim() ? lyrics : (result?.lyrics || ''),
        tags: result?.tags || '',
        vocal_gender: result?.vocal_gender || '',
        vocal_timbre: result?.vocal_timbre || '',
        content_hash: result?.content_hash || '',
        clip_id: result?.clip_id || '',
        wav_url: result?.wav_url || '',
        sound_prompt: soundPrompt || '',
        model: result?.model_version || (provider === 'sonic' ? sonicModel : temporlorModel),
      },
    );
    if (asset?.id) {
      setSavedAssetId(asset.id);
      toast.success(mastersBrief ? '👑 Saved with full Masters report!' : 'Saved to library!');
    } else {
      toast.error('Could not save to your library — please try again.');
    }
    setSaving(false);
  };

  const audioUrl = result?.audio_url || result?.output_url;

  return (
    <div className="space-y-6">
      {/* Provider */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Provider</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {PROVIDERS.map(p => (
            <button key={p.value} onClick={() => setProvider(p.value)}
              className={`p-3 rounded-xl border text-left transition-all ${provider === p.value ? p.color : 'border-border bg-card hover:border-border/80'}`}>
              <p className="text-sm font-bold text-foreground">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">✨ More AI music models coming soon.</p>
      </div>

      {/* Track Title — raised into its own accented card. As a plain input it read
          as page furniture and was routinely missed, so creators shipped tracks
          under the auto mood/genre name without realising they could name them. */}
      <div className={`p-4 rounded-2xl border-2 transition-colors ${customTitle.trim() ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-cyan-500/50 bg-cyan-500/[0.06]'}`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Type className="w-4 h-4 text-cyan-300" />
          <p className="text-xs font-black text-foreground uppercase">Track Title</p>
          <span className="text-[10px] font-semibold text-muted-foreground normal-case">optional — name it yourself</span>
          {customTitle.trim() && (
            <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1 ml-auto">
              <CheckCircle className="w-3 h-3" /> Custom title set
            </span>
          )}
        </div>
        <Input
          type="text"
          value={customTitle}
          onChange={e => setCustomTitle(e.target.value)}
          placeholder={`Auto: ${mood} ${genre} — ${providerLabel(provider)}`}
          maxLength={80}
          className="rounded-xl bg-background text-base font-semibold border-cyan-500/40 focus-visible:ring-2 focus-visible:ring-cyan-400/70"
        />
        <p className="text-[10px] text-muted-foreground mt-1.5">Leave blank to use "{mood} {genre} — {providerLabel(provider)}". Your title is applied everywhere: library, ID3 tags, and Community Buzz.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Controls */}
        <div className="space-y-5">
          {/* Genre */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Genre</p>
            <ChipSelector
              chipType="genre"
              defaults={GENRE_CHIPS}
              selected={genre}
              onSelect={setGenre}
              activeClass="bg-blue-600 text-white"
            />
          </div>

          {/* Mood */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Mood</p>
            <ChipSelector
              chipType="mood"
              defaults={MOOD_CHIPS}
              selected={mood}
              onSelect={setMood}
              activeClass="bg-purple-600 text-white"
            />
          </div>

          {/* Duration */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Duration: <span className="text-foreground">{duration ? `${duration}s` : 'Any'}</span>
            </p>
            <ChipSelector
              chipType="duration"
              defaults={DURATIONS.map(String)}
              selected={duration ? String(duration) : null}
              onSelect={v => setDuration(v ? parseInt(v) : null)}
              activeClass="bg-cyan-600 text-white"
              labelSuffix="s"
              allowAny
              anyLabel="Any"
            />
          </div>

          {/* BPM */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Tempo (BPM)</p>
            <Input type="number" value={tempo} onChange={e => setTempo(e.target.value)} min="60" max="200" className="rounded-xl" />
          </div>

          {/* Model-specific controls */}
          {provider === 'sonic' && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">AI Model</p>
              <ModelFamilySelect families={SONIC_FAMILIES} value={sonicModel} onSelect={setSonicModel}
                accentClass="border-cyan-500 bg-cyan-500/10" />
              <div className="mt-4">
                <SonicStyleControls model={sonicModel} value={sonicStyle} onChange={setSonicStyle} />
              </div>
            </div>
          )}

          {provider === 'tempcolor' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                {[{ value: 'song', label: '🎤 Song', desc: 'Vocals' }, { value: 'instrumental', label: '🎼 Instrumental', desc: 'No vocals' }].map(m => (
                  <button key={m.value} onClick={() => { setTemporlorMode(m.value); setTemporlorModel(m.value === 'instrumental' ? 'TemPolor i4' : 'tempolor-latest'); }}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-all ${temporlorMode === m.value ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-card'}`}>
                    <p className="text-xs font-bold text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">AI Model</p>
              <ModelFamilySelect
                families={temporlorMode === 'instrumental' ? TEMPOLOR_INSTRUMENTAL_FAMILIES : TEMPOLOR_SONG_FAMILIES}
                value={temporlorModel}
                onSelect={setTemporlorModel}
                accentClass="border-amber-500 bg-amber-500/10"
              />
            </div>
          )}


          {/* Voice Persona */}
          {voicePersonas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Voice Persona</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setSelectedPersona('none')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selectedPersona === 'none' ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground'}`}>
                  None
                </button>
                {voicePersonas.map(p => (
                  <button key={p.id} onClick={() => setSelectedPersona(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${selectedPersona === p.id ? 'bg-pink-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                    <Mic2 className="w-3 h-3" /> {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Prompt + Lyrics + Output */}
        <div className="lg:col-span-2 space-y-5">
          {/* STEP 1 — Sound Description (primary input, always visible first) */}
          <div className={`p-4 rounded-2xl border-2 transition-colors ${soundPrompt.trim() ? 'border-blue-500/40 bg-blue-500/5' : 'border-amber-500/50 bg-amber-500/5'}`}>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <p className="text-xs font-black text-foreground uppercase flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
                Sound Description
              </p>
              {!soundPrompt.trim() && (
                <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Required — describe your track
                </span>
              )}
            </div>
            <textarea value={soundPrompt} onChange={e => setSoundPrompt(e.target.value)}
              placeholder="Describe the sound: e.g. hard 808s, mellow Rhodes, driving guitar riff…"
              rows={3}
              className="w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mt-2 mb-1.5 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Or start from a template — scroll for more →</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
              {PROMPT_TEMPLATES.map(t => (
                <button key={t.label} onClick={() => setSoundPrompt(t.prompt)}
                  className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${soundPrompt === t.prompt ? 'border-blue-500 bg-blue-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-blue-500/40 hover:text-foreground'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* STEP 2 — Lyrics & Songwriting (all lyric tools in one card) */}
          <div className="p-4 rounded-2xl border border-pink-500/30 bg-card space-y-4">
            <p className="text-xs font-black text-foreground uppercase flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-pink-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
              <Music2 className="w-3 h-3 text-pink-400" /> Lyrics & Songwriting
              <span className="text-[10px] font-semibold text-muted-foreground normal-case">optional</span>
            </p>

            {importedFromStudio && (
              <div className="mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/30">
                <CheckCircle className="w-4 h-4 text-pink-400 flex-shrink-0" />
                <p className="text-xs text-pink-300 flex-1">Lyrics imported from Lyrics Studio — ready to generate.</p>
              </div>
            )}

            {/* Vocal-provider detection — key signal for AI model selection */}
            {((provider === 'sonic' && !sonicStyle.instrumental) || (provider === 'tempcolor' && temporlorMode === 'song')) &&
              !(lyricsMode !== 'none' && lyrics.trim().length > 0) && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-300">This provider supports vocal generation</p>
                  <p className="text-xs text-muted-foreground">
                    Add lyrics below for best results, or AI will generate an instrumental.{' '}
                    <Link to="/lyrics-studio" className="text-amber-300 underline hover:text-amber-200">Open Lyrics Studio →</Link>
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-3 flex-wrap">
              {[
                { value: 'none', label: 'No Lyrics' },
                { value: 'generate', label: '✨ AI Generate' },
                { value: 'custom', label: '✍️ Write Custom' },
                ...(savedLyrics.length > 0 ? [{ value: 'saved', label: '📁 From Library' }] : []),
              ].map(opt => (
                <button key={opt.value} onClick={() => setLyricsMode(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${lyricsMode === opt.value ? 'bg-pink-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  {opt.label}
                </button>
              ))}
            </div>

            {lyricsMode === 'generate' && (
              <div className="space-y-2">
                <Button onClick={generateLyricsAI} disabled={generatingLyrics} size="sm" variant="outline" className="rounded-xl gap-1.5">
                  {generatingLyrics ? 'Generating…' : '✨ Generate Lyrics from Lyrics Studio'}
                </Button>
                {lyrics && (
                  <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={6}
                    className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
                )}
              </div>
            )}

            {lyricsMode === 'custom' && (
              <textarea value={lyrics} onChange={e => setLyrics(e.target.value)}
                placeholder="Paste or write your lyrics here…" rows={6}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
            )}

            {/* Per-model compatibility check — chars vs budget, vocal support, language + tag guidance */}
            {lyricsMode !== 'none' && (
              <LyricsCompatibilityCheck
                lyrics={debouncedLyrics}
                provider={provider}
                model={activeModel}
                mode={provider === 'tempcolor' ? temporlorMode : 'song'}
              />
            )}

            {lyricsMode === 'saved' && savedLyrics.length > 0 && (
              <div className="space-y-2">
                <SavedLyricsPicker assets={savedLyrics} onSelect={setLyrics} />
                {/* The loaded words are shown and stay editable — otherwise there is
                    no way to tell whether the selection actually carried any lyrics. */}
                {lyrics && (
                  <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={6}
                    className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
                )}
              </div>
            )}

            {/* 243 Masters — pro songwriting inside the lyrics toolkit */}
            <div className="pt-3 border-t border-border/60">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-300" />
                  <div>
                    <p className="text-xs font-black text-amber-200">243 Masters Engine</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Writes lyrics, chords, arrangement & fills the sound description for you
                    </p>
                  </div>
                </div>
                <Button onClick={runMastersEngine} disabled={runningMasters}
                  size="sm"
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold gap-1.5 text-xs">
                  {runningMasters ? 'Composing…' : 'Craft with Masters'}
                  <CostBadge cost={3} size="sm" />
                </Button>
              </div>
              {mastersBrief && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-end">
                    <SaveMastersReportButton brief={mastersBrief} lyrics={lyrics} genre={genre} mood={mood} />
                  </div>
                  <MastersBriefDisplay result={mastersBrief} />
                </div>
              )}
            </div>
          </div>

          {/* Persistent error banner — survives toast dismissal so users always see why generation stopped */}
          <QuickErrorBanner error={lastError} onDismiss={() => setLastError(null)} />

          {/* Generate Button */}
          <Button onClick={generate} disabled={isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-base py-5 gap-2">
            <Zap className="w-5 h-5" />
            {isProcessing ? (jobId ? `Processing… ${progress}%` : 'Starting…') : '🎛️ Generate Track'}
            {!isProcessing && <CostBadge cost={provider === 'sonic' ? sonicGenerationCost(sonicModel, true) : (PROVIDER_COSTS[provider] || 5)} />}
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
                  <p className="text-xs text-blue-300 mt-1">AI is composing your track — 20–60s depending on provider…</p>
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
                    <img src={result.cover_image_url} alt="Cover" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-border" />
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

                <TrainingFeedback sampleId={sampleId} />

                {/* Lyrics preview — embedded into ID3 USLT frame */}
                {(result?.lyrics || lyrics) && (
                  <details className="rounded-xl bg-muted/50 border border-border overflow-hidden">
                    <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-2">
                      <Mic2 className="w-3.5 h-3.5 text-pink-400" /> Lyrics (embedded in ID3 tags)
                    </summary>
                    <pre className="px-4 py-3 text-xs text-muted-foreground whitespace-pre-wrap font-sans max-h-72 overflow-y-auto border-t border-border">
                      {result?.lyrics || lyrics}
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
                  <Button onClick={saveToLibrary} disabled={saving || !!savedAssetId}
                    className="flex-1 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold disabled:opacity-100">
                    {savedAssetId ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {savedAssetId ? 'In Your Library' : saving ? 'Saving…' : 'Save to Library'}
                  </Button>
                  <MasterDownloadButtons
                    mp3Url={audioUrl}
                    wavUrl={result?.wav_url}
                    clipId={result?.clip_id}
                    provider={provider}
                    assetId={savedAssetId}
                    title={customTitle.trim() || `${mood} ${genre}`}
                  />
                  <MidiExportButton clipId={result?.clip_id} bpm={result?.bpm} musicalKey={result?.key} title={`${mood} ${genre}`} />
                  <Button variant="outline" onClick={extendTrack} disabled={extending} className="gap-2 rounded-xl text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10">
                    {extending ? <RotateCcw className="w-4 h-4 animate-spin" /> : <ChevronsRight className="w-4 h-4" />}
                    {extending ? 'Extending…' : 'Extend'}
                  </Button>
                  <Button variant="outline" onClick={() => {       setResult(null); setJobId(''); setSavedAssetId(null); }} className="gap-2 rounded-xl">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}