import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Save, Download, RotateCcw, CheckCircle, Sparkles, Mic2, Image, Palette, Music2, ChevronsRight, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useJobPolling } from '@/hooks/useJobPolling';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import MidiExportButton from '@/components/music/MidiExportButton';
import ChipSelector from '@/components/music/ChipSelector';
import MastersBriefDisplay from '@/components/songwriting/MastersBriefDisplay';
import SaveMastersReportButton from '@/components/songwriting/SaveMastersReportButton';
import { Crown } from 'lucide-react';
import { handleCreditError, refreshCreditsFromResponse, getProviderErrorMessage } from '@/utils/creditErrors';
import CostBadge from '@/components/credits/CostBadge';
import LyricsCompatibilityCheck from '@/components/music/LyricsCompatibilityCheck';
import { getLyricsSpec } from '@/config/modelLyricsSpec';
import { calculateHumanParticipationScore } from '@/utils/participationScore';

// Per-provider costs — must match backend CREDIT_COSTS in generateMusic.
// aimusicapi.ai spec: Sonic = 10 credits (returns 2 songs), Producer = 10 credits (1 song).
// Tempolor: 10 credits per song.
const PROVIDER_COSTS = { sonic: 10, tempcolor: 10, elevenlabs: 10 };

const PROVIDERS = [
  { value: 'sonic',      label: 'Sonic',      desc: 'Generates 2 tracks + cover art', color: 'border-cyan-500 bg-cyan-500/10' },
  { value: 'tempcolor',  label: 'Tempolor',   desc: 'Song & instrumental modes + Lyria 3 Pro', color: 'border-amber-500 bg-amber-500/10' },
  { value: 'elevenlabs', label: 'ElevenLabs', desc: 'Eleven Music — instant results, C2PA-signed', color: 'border-violet-500 bg-violet-500/10' },
];

const SONIC_MODELS = [
  { value: 'sonic-v3-5', label: 'v3.5', desc: 'Legacy' },
  { value: 'sonic-v4', label: 'v4', desc: 'Improved quality' },
  { value: 'sonic-v4-5', label: 'v4.5', desc: 'Enhanced vocals' },
  { value: 'sonic-v4-5-all', label: 'v4.5 All', desc: 'Fast variant' },
  { value: 'sonic-v4-5-plus', label: 'v4.5 Plus', desc: 'Premium quality' },
  { value: 'sonic-v5', label: 'v5', desc: 'Latest' },
  { value: 'sonic-v5-5', label: 'v5.5', desc: 'Best quality' },
];

// Tempolor model catalog — audited from platform.tempolor.com/docs (Model and Pricing).
// Each entry's desc classifies the model's specialty so users can pick the right tool.
const TEMPOLOR_SONG_MODELS = [
  { value: 'TemPolor v4.6', label: 'TemPolor v4.6', desc: '⭐ Flagship — best all-round, 5 min, 30+ languages' },
  { value: 'TemPolor v3.5', label: 'TemPolor v3.5', desc: 'Natural, lifelike vocals — 4.5 min, EN/ZH/JA/Cantonese' },
  { value: 'Lyria 3 Pro', label: 'Lyria 3 Pro', desc: 'By Google — polished vocals, 3 min, multilingual' },
  { value: 'Mureka V9', label: 'Mureka V9', desc: 'Richest arrangements — 5.5 min, 10+ languages' },
  { value: 'MiniMax 2.6', label: 'MiniMax 2.6', desc: 'Premium vocals — longest tracks (6 min)' },
];
const TEMPOLOR_INSTRUMENTAL_MODELS = [
  { value: 'TemPolor i3.5', label: 'TemPolor i3.5', desc: '⭐ Flagship instrumental — 4.5 min, precise duration control' },
  { value: 'TemPolor i3', label: 'TemPolor i3', desc: 'Fastest (<3s) & most cost-effective — 2 min' },
  { value: 'Lyria 3 Pro', label: 'Lyria 3 Pro', desc: 'By Google — clean instrumentals, 3 min' },
  { value: 'Mureka V9', label: 'Mureka V9', desc: 'Rich, layered arrangements — 4.5 min' },
  { value: 'MiniMax 2.6', label: 'MiniMax 2.6', desc: 'Premium — longest instrumentals (6 min)' },
];

// ElevenLabs Eleven Music — synchronous generation (no polling), C2PA-signed output.
const ELEVEN_MODELS = [
  { value: 'music_v1', label: 'Eleven Music v1', desc: '⭐ Flagship — vocals or instrumental, up to 10 min' },
  { value: 'music_v2', label: 'Eleven Music v2', desc: 'Latest — highest fidelity 48kHz output' },
];

const GENRE_CHIPS = ['Hip-Hop', 'Trap', 'EDM', 'House', 'Pop', 'R&B', 'Lo-Fi', 'Jazz', 'Rock', 'Afrobeats', 'Drill', 'Ambient'];
const MOOD_CHIPS = ['Energetic', 'Chill', 'Dark', 'Happy', 'Sad', 'Uplifting', 'Aggressive', 'Romantic', 'Melancholic'];
const DURATIONS = [15, 30, 60, 90, 120];

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

export default function AdvancedGenerateTab({ initialLyricsAssetId = '', initialGenre = '', initialTopic = '' }) {
  const [provider, setProvider] = useState('sonic');
  const [importedFromStudio, setImportedFromStudio] = useState(false);
  const [sonicModel, setSonicModel] = useState('sonic-v4-5-plus');
  const [temporlorMode, setTemporlorMode] = useState('song');
  const [temporlorModel, setTemporlorModel] = useState('TemPolor v4.6');
  const [elevenModel, setElevenModel] = useState('music_v1');
  const [duration, setDuration] = useState(null); // null = "Any" (let provider decide)
  const [genre, setGenre] = useState(initialGenre || 'Hip-Hop');
  const [mood, setMood] = useState('Energetic');
  const [tempo, setTempo] = useState('120');
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
  const [lastError, setLastError] = useState(null); // persistent failure banner
  const [mastersBrief, setMastersBrief] = useState(null); // 243 Masters brief imported from Lyrics Studio
  const [runningMasters, setRunningMasters] = useState(false);
  const savedRef = useRef(false); // prevent duplicate auto-saves

  // Debounced values to prevent input handler violations on rapid keystrokes
  const debouncedSoundPrompt = useDebouncedValue(soundPrompt, 200);
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
        // Prefer inline metadata.content (set by Lyrics Studio export); fall back to fetching the .txt
        let text = asset?.metadata?.content;
        if (!text && asset?.file_url) {
          const res = await fetch(asset.file_url);
          if (res.ok) text = await res.text();
        }
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
      const participation = calculateHumanParticipationScore({
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
            softwareUsed: `BASE Station (${provider}${extraMeta?.model ? ` ${extraMeta.model}` : ''})`,
            comment: `Generated by BASE Station using ${provider}${extraMeta?.model ? ` (${extraMeta.model})` : ''}`,
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

      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: extraMeta?.title || titleOverride || `${mood} ${genre} — ${provider}`,
        file_url: finalUrl,
        thumbnail_url: coverImageUrl || '',
        is_public: false,
        ai_label: participation.label,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
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
      await saveTrackToLibrary(primaryUrl, coverImageUrl, `${mood} ${genre} — ${provider}`, {
        title: data.title || `${mood} ${genre} — ${provider}`,
        bpm: data.bpm,
        key: data.key,
        duration: data.duration || duration,
        lyrics: mergedLyrics,
        tags: data.tags || '',
        vocal_gender: data.vocal_gender || '',
        vocal_timbre: data.vocal_timbre || '',
        sound_prompt: soundPrompt || '',
        content_hash: data.content_hash || null,
        model: data.model_version || (provider === 'sonic' ? sonicModel : provider === 'tempcolor' ? temporlorModel : provider === 'elevenlabs' ? elevenModel : 'FUZZ-2.0'),
      });
      // Reflect provider-returned lyrics into UI so user can see them
      if (mergedLyrics && !lyrics?.trim()) {
        setLyrics(mergedLyrics);
        setLyricsMode('custom');
        setResult(prev => ({ ...prev, lyrics: mergedLyrics }));
      }
      toast.success('✅ Auto-saved to library with full metadata!');
    }
  }, [mood, genre, provider, saveTrackToLibrary, lyrics, soundPrompt, duration, sonicModel, temporlorModel]);

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
        model: temporlorMode === 'instrumental' ? 'TemPolor i3.5' : 'TemPolor v4.6',
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
  const activeModel = provider === 'sonic' ? sonicModel : provider === 'tempcolor' ? temporlorModel : provider === 'elevenlabs' ? elevenModel : 'FUZZ-2.0';
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
    setLastError(null);
    savedRef.current = false; // reset guard for new generation
    // Read latest values directly from state refs to avoid stale closure issues
    const currentPrompt = soundPrompt;
    const currentLyrics = lyrics;
    try {
      const res = await base44.functions.invoke('generateMusic', {
        provider,
        ...(duration && { duration }),
        genre, mood,
        tempo: parseInt(tempo, 10) || 120,
        sound_prompt: currentPrompt || `${mood} ${genre} track`,
        ...(currentLyrics && lyricsMode !== 'none' && { lyrics: currentLyrics }),
        ...(selectedPersona !== 'none' && { voice_persona_id: selectedPersona }),
        ...(provider === 'sonic' && { model: sonicModel }),
        ...(provider === 'tempcolor' && { model: temporlorModel, tempolor_mode: temporlorMode }),
        ...(provider === 'elevenlabs' && { model: elevenModel }),
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

  const saveToLibrary = async () => {
    const audioUrl = result?.audio_url || result?.output_url;
    if (!audioUrl) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      // Use the SAME complete metadata payload as auto-save so lyrics, model,
      // content_hash, clip_id, etc. are preserved on manually-saved tracks too.
      const mergedLyrics = lyrics?.trim() ? lyrics : (result?.lyrics || '');
      const participation = calculateHumanParticipationScore({
        userProvidedContent: (lyricsMode === 'custom' || lyricsMode === 'saved') && !!lyrics?.trim(),
        prompt: soundPrompt || '',
        styleOrTags: [genre, mood].filter(Boolean),
        personaOrTemplate: selectedPersona !== 'none' || !!mastersBrief,
        isIteration: false,
      });
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: result?.title || `${mood} ${genre} — ${provider}`,
        file_url: audioUrl,
        thumbnail_url: result.cover_image_url || '',
        is_public: false,
        ai_label: participation.label,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
        metadata: {
          genre, mood, tempo, provider,
          duration: result?.duration || duration,
          bpm: result?.bpm,
          key: result?.key,
          model: result?.model_version || (provider === 'sonic' ? sonicModel : provider === 'tempcolor' ? temporlorModel : provider === 'elevenlabs' ? elevenModel : ''),
          ai_assisted: true,
          sound_prompt: soundPrompt || '',
          lyrics: mergedLyrics,
          tags: result?.tags || '',
          vocal_gender: result?.vocal_gender || '',
          vocal_timbre: result?.vocal_timbre || '',
          content_hash: result?.content_hash || '',
          clip_id: result?.clip_id || '',
          wav_url: result?.wav_url || '',
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
      toast.success(mastersBrief ? '👑 Saved with full Masters report!' : 'Saved to library!');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || err.message);
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
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Model Version</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SONIC_MODELS.map(m => (
                  <button key={m.value} onClick={() => setSonicModel(m.value)}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-all ${sonicModel === m.value ? 'border-cyan-500 bg-cyan-500/10' : 'border-border bg-card'}`}>
                    <p className="text-xs font-bold text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {provider === 'tempcolor' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                {[{ value: 'song', label: '🎤 Song', desc: 'Vocals' }, { value: 'instrumental', label: '🎼 Instrumental', desc: 'No vocals' }].map(m => (
                  <button key={m.value} onClick={() => { setTemporlorMode(m.value); setTemporlorModel(m.value === 'instrumental' ? 'TemPolor i3.5' : 'TemPolor v4.6'); }}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-all ${temporlorMode === m.value ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-card'}`}>
                    <p className="text-xs font-bold text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(temporlorMode === 'instrumental' ? TEMPOLOR_INSTRUMENTAL_MODELS : TEMPOLOR_SONG_MODELS).map(m => (
                  <button key={m.value} onClick={() => setTemporlorModel(m.value)}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-all ${temporlorModel === m.value ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-card'}`}>
                    <p className="text-xs font-bold text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {provider === 'elevenlabs' && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Model Version</p>
              <div className="grid grid-cols-1 gap-1.5">
                {ELEVEN_MODELS.map(m => (
                  <button key={m.value} onClick={() => setElevenModel(m.value)}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-all ${elevenModel === m.value ? 'border-violet-500 bg-violet-500/10' : 'border-border bg-card'}`}>
                    <p className="text-xs font-bold text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">⚡ Synchronous — your track returns in one step, C2PA provenance-signed.</p>
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
            {(provider === 'sonic' || (provider === 'tempcolor' && temporlorMode === 'song')) &&
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
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {savedLyrics.map(l => (
                  <button key={l.id} onClick={() => setLyrics(l.metadata?.content || l.description || l.title)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs transition-colors">
                    <p className="font-semibold text-foreground">{l.title}</p>
                    <p className="text-muted-foreground truncate">{l.description}</p>
                  </button>
                ))}
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

          {/* Generate Button */}
          <Button onClick={generate} disabled={isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-base py-5 gap-2">
            <Zap className="w-5 h-5" />
            {isProcessing ? (jobId ? `Processing… ${progress}%` : 'Starting…') : '🎛️ Generate Track'}
            {!isProcessing && <CostBadge cost={PROVIDER_COSTS[provider] || 5} />}
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
                  <Button onClick={saveToLibrary} disabled={saving} className="flex-1 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold">
                    <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save to Library'}
                  </Button>
                  <a href={audioUrl} download className="flex-1">
                    <Button variant="outline" className="w-full gap-2 rounded-xl">
                      <Download className="w-4 h-4" /> Download
                    </Button>
                  </a>
                  <MidiExportButton audioUrl={audioUrl} bpm={result?.bpm} musicalKey={result?.key} title={`${mood} ${genre}`} />
                  <Button variant="outline" onClick={extendTrack} disabled={extending} className="gap-2 rounded-xl text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10">
                    {extending ? <RotateCcw className="w-4 h-4 animate-spin" /> : <ChevronsRight className="w-4 h-4" />}
                    {extending ? 'Extending…' : 'Extend'}
                  </Button>
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
  );
}