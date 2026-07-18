import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic2, Zap, Copy, Download, RefreshCw, Save, ArrowLeft,
  CheckCircle, Sparkles, Keyboard, Plus, X, History, Music, Crown
} from 'lucide-react';
import MastersBriefDisplay from '@/components/songwriting/MastersBriefDisplay';
import { useNavigate } from 'react-router-dom';
import ChipSelector from '@/components/music/ChipSelector';
import MultiChipSelector from '@/components/music/MultiChipSelector';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { handleCreditError, refreshCreditsFromResponse } from '@/utils/creditErrors';
import CostBadge from '@/components/credits/CostBadge';
import InfoTip from '@/components/common/InfoTip';
import TargetModelSelect from '@/components/songwriting/TargetModelSelect';
import LyricsCompatibilityCheck from '@/components/music/LyricsCompatibilityCheck';
import StyleReferenceDisclaimer from '@/components/songwriting/StyleReferenceDisclaimer';
import EngineModeSelector from '@/components/songwriting/EngineModeSelector';
import { getLyricsSpec } from '@/config/modelLyricsSpec';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { calculateHumanParticipationScore } from '@/utils/participationScore';

const MOOD_CHIPS   = ['Happy', 'Sad', 'Energetic', 'Melancholic', 'Romantic', 'Angry', 'Chill', 'Nostalgic', 'Triumphant'];
const STYLE_CHIPS  = ['Hip-Hop', 'Pop', 'Rock', 'R&B', 'EDM', 'Indie', 'Country', 'Traditional Country', 'Red Dirt Country', 'Texas Country', 'Soul', 'Drill', 'Afrobeats', 'Lo-Fi', 'Jazz', 'Blues', 'Metal'];
const LENGTHS      = ['Short (8–16 bars)', 'Medium (32 bars)', 'Long (64+ bars)', 'Full Song'];

const RHYME_SCHEMES = [
  { value: 'Mixed',  label: 'Mixed', desc: 'Smart mix — best for hit songs' },
  { value: 'ABAB',   label: 'ABAB',  desc: 'Alternate rhyme — most popular' },
  { value: 'AABB',   label: 'AABB',  desc: 'Couplets — punchy & direct' },
  { value: 'XAXA',   label: 'XAXA',  desc: 'Conversational — modern feel' },
  { value: 'ABBA',   label: 'ABBA',  desc: 'Envelope — cinematic wrap' },
  { value: 'AAAA',   label: 'AAAA',  desc: 'Monorhyme — tension builder' },
  { value: 'AAAX',   label: 'AAAX',  desc: 'Tension release — punchy drop' },
];

const STRUCTURE_TEMPLATES = [
  // Pop / General
  { label: '🎵 Standard Pop',       genre: 'Pop',           text: '[Intro]\n\n[Verse 1]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Verse 2]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Bridge]\n\n[Chorus]\n\n[Outro]' },
  { label: '✨ Minimal',            genre: 'Pop',           text: '[Verse]\n\n[Chorus]\n\n[Verse]\n\n[Chorus]' },
  // Hip-Hop / Rap
  { label: '🔥 Hip-Hop / Rap',      genre: 'Hip-Hop',       text: '[Intro]\n\n[Verse 1]\n\n[Hook]\n\n[Verse 2]\n\n[Hook]\n\n[Verse 3]\n\n[Outro]' },
  { label: '💀 Drill / Trap',       genre: 'Drill',         text: '[Intro]\n\n[Verse 1]\n\n[Hook]\n\n[Verse 2]\n\n[Hook]\n\n[Bridge]\n\n[Hook]\n\n[Outro]' },
  // R&B / Soul
  { label: '🌊 R&B / Soul',         genre: 'R&B',           text: '[Intro]\n\n[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Bridge]\n\n[Vamp / Outro]' },
  { label: '💜 Neo-Soul',           genre: 'Soul',          text: '[Intro]\n\n[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Ad-lib Break]\n\n[Bridge]\n\n[Chorus]\n\n[Outro]' },
  // Rock
  { label: '🎸 Rock / Alt Rock',    genre: 'Rock',          text: '[Intro riff]\n\n[Verse 1]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Verse 2]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Guitar Solo]\n\n[Bridge]\n\n[Chorus x2]\n\n[Outro]' },
  { label: '🤘 Hard Rock / Metal',  genre: 'Rock',          text: '[Intro]\n\n[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Solo]\n\n[Breakdown]\n\n[Chorus]\n\n[Outro]' },
  // Country
  { label: '🤠 Traditional Country',  genre: 'Country',     text: '[Intro]\n\n[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Verse 3]\n\n[Chorus]\n\n[Tag / Outro]' },
  { label: '🎙️ Modern Country',      genre: 'Country',     text: '[Intro]\n\n[Verse 1]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Verse 2]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Bridge]\n\n[Chorus]\n\n[Outro]' },
  { label: '🌵 Red Dirt Country',    genre: 'Red Dirt',     text: '[Intro]\n\n[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Instrumental Break]\n\n[Verse 3]\n\n[Chorus]\n\n[Outro]' },
  { label: '🤟 Texas Country',       genre: 'Texas Country', text: '[Intro]\n\n[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Guitar Break]\n\n[Verse 3]\n\n[Chorus]\n\n[Tag]' },
  // EDM / Electronic
  { label: '⚡ EDM / Dance',         genre: 'EDM',           text: '[Intro]\n\n[Build-Up]\n\n[Drop]\n\n[Breakdown]\n\n[Build-Up 2]\n\n[Drop 2]\n\n[Outro]' },
  // Lo-Fi / Indie
  { label: '☕ Lo-Fi / Chill',       genre: 'Lo-Fi',         text: '[Intro]\n\n[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Outro]' },
  { label: '🌿 Indie / Alt',         genre: 'Indie',         text: '[Intro]\n\n[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Bridge]\n\n[Chorus]\n\n[Outro]' },
  // Jazz / Blues
  { label: '🎷 Jazz / Blues',        genre: 'Jazz',          text: '[Intro / Head]\n\n[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Instrumental Solo]\n\n[Chorus]\n\n[Outro / Head Out]' },
  // Afrobeats / Global
  { label: '🌍 Afrobeats',           genre: 'Afrobeats',     text: '[Intro]\n\n[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Dance Break]\n\n[Chorus]\n\n[Outro]' },
];

const TOPIC_SUGGESTIONS = [
  'overcoming heartbreak', 'late night drives', 'chasing dreams', 'loyalty and trust',
  'making it from nothing', 'toxic love', 'nostalgia for childhood', 'finding yourself',
];

export default function LyricsStudio() {
  const [topic, setTopic] = useState('');
  const [mood, setMood] = useState(['Happy']);
  const [style, setStyle] = useState(['Hip-Hop']);
  const [length, setLength] = useState('Medium (32 bars)');
  const [rhymeScheme, setRhymeScheme] = useState('Mixed');
  const [proMode, setProMode] = useState(false);
  const [mastersMode, setMastersMode] = useState(false);
  const [mastersResult, setMastersResult] = useState(null);
  const [referenceArtists, setReferenceArtists] = useState('');
  const [proBpm, setProBpm] = useState('');
  const [matchedGenre, setMatchedGenre] = useState(null);
  const [genreCraft, setGenreCraft] = useState(null);
  const [showCraftSheet, setShowCraftSheet] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showRedDirtInfo, setShowRedDirtInfo] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lookingUpWriter, setLookingUpWriter] = useState(false);
  const [writerProfile, setWriterProfile] = useState(null);
  const [targetModel, setTargetModel] = useState('sonic|sonic-v4-5-plus');
  const textareaRef = useRef(null);
  const navigate = useNavigate();
  // Debounce lyrics for the compatibility checker — prevents per-keystroke lag/lockups
  const debouncedLyrics = useDebouncedValue(lyrics, 250);

  const lookupWriter = async () => {
    const name = referenceArtists.trim();
    if (!name) return;
    setLookingUpWriter(true);
    try {
      const res = await base44.functions.invoke('lookupWriterStyle', { writer: name });
      const data = res.data || {};
      if (data.error) { toast.error(data.error); return; }
      // Apply to form
      if (data.moods?.length)  setMood(data.moods);
      if (data.styles?.length) setStyle(data.styles);
      if (data.length)         setLength(data.length);
      if (data.rhyme_scheme)   setRhymeScheme(data.rhyme_scheme);
      if (data.bpm)            setProBpm(String(data.bpm));
      setWriterProfile(data);
      toast.success(`🎯 Profile loaded: ${data.matched_name}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message);
    }
    setLookingUpWriter(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generate(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's')     { e.preventDefault(); saveLyrics(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k')     { e.preventDefault(); setShowShortcuts(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [topic, mood, style, length, lyrics, mastersResult]);

  // Fired once per session when user first focuses the "Your Lyrics" textarea
  const showCharLimitNotice = () => {
    if (sessionStorage.getItem('lyricsCharLimitNoticeSeen')) return;
    toast.info(
      '⚠️ Heads up: each AI music model has its own lyrics character limit. Going over the limit will cause music generation to fail downstream — keep verses concise.',
      { duration: 9000 }
    );
    sessionStorage.setItem('lyricsCharLimitNoticeSeen', '1');
  };

  // Model-aware lyric budget: length preset capped by the target music model's hard limit
  const [tmProvider, tmModel] = targetModel.split('|');
  const modelMaxChars = getLyricsSpec(tmProvider, tmModel).maxLyricsChars;
  const maxCharsMap = {
    'Short (8–16 bars)': 1500,
    'Medium (32 bars)': 2500,
    'Long (64+ bars)': 4000,
    'Full Song': 5000,
  };
  const effectiveMaxChars = (len) => Math.min(maxCharsMap[len] || 2500, modelMaxChars);

  const generate = async () => {
    if (!topic) { toast.error('Enter a topic first'); return; }
    setLoading(true);
    setMastersResult(null);
    try {
      let text = '';
      let lastResponse = null;
      if (mastersMode) {
        // 243 Masters Engine — lyrics + chords + arrangement + production brief
        const res = await base44.functions.invoke('generate243Masters', {
          topic,
          genre: style.join(', '),
          mood: mood.join(', '),
          rhyme_scheme: rhymeScheme,
          reference_artists: referenceArtists || undefined,
          bpm: proBpm ? Number(proBpm) : undefined,
          max_chars: effectiveMaxChars(length),
        });
        lastResponse = res;
        text = res.data?.lyrics_clamped || res.data?.lyrics || '';
        setMastersResult(res.data);
        if (res.data?.clamped) {
          toast.warning(`Clamped to ${text.length} chars for ${tmModel} compatibility.`);
        }
      } else if (proMode) {
        // Professional Songwriting Engine — CanonicalLyricJob-compatible
        const res = await base44.functions.invoke('generateLyricsPro', {
          concept: topic,
          genre: style.join(', '),
          mood: mood.join(', '),
          rhyme_scheme: rhymeScheme,
          reference_artists: referenceArtists || undefined,
          bpm: proBpm ? Number(proBpm) : undefined,
          max_chars: effectiveMaxChars(length),
        });
        lastResponse = res;
        text = res.data?.lyrics_clamped || res.data?.lyrics || '';
        setMatchedGenre(res.data?.matched_genre || null);
        setGenreCraft(res.data?.genre_craft || null);
        if (res.data?.clamped) {
          toast.warning(`Clamped to ${text.length} chars (was ${res.data.original_length}) for ${tmModel} compatibility.`);
        }
      } else {
        const res = await base44.functions.invoke('generateLyrics', { topic, mood: mood.join(', '), style: style.join(', '), length, rhyme_scheme: rhymeScheme, max_chars: effectiveMaxChars(length) });
        lastResponse = res;
        text = res.data?.lyrics || res.data?.text || res.data?.content || '';
      }

      if (text) {
        if (lyrics) setVersions(v => [{ text: lyrics, timestamp: Date.now() }, ...v].slice(0, 5));
        setLyrics(text);
        toast.success(mastersMode ? '👑 243 Masters engine complete!' : proMode ? '🎼 Pro lyrics generated!' : 'Lyrics generated!');
        // Refresh credits widget — server returns credits_remaining on success
        refreshCreditsFromResponse(lastResponse?.data);
      } else {
        toast.error('No lyrics returned — check backend function');
      }
    } catch (err) {
      if (!handleCreditError(err)) toast.error(err?.response?.data?.message || err.message);
    }
    setLoading(false);
  };

  const saveLyrics = async () => {
    if (!lyrics) { toast.error('No lyrics to save'); return; }
    setSaving(true);
    try {
      const user = await base44.auth.me();
      // If a 243 Masters report exists, save the full content report alongside the lyrics
      const isMasters = !!mastersResult;
      let fileText = lyrics;
      if (isMasters) {
        const m = mastersResult;
        const chords = (m.chord_progression || [])
          .map(c => `${c.section}: ${c.nashville} | ${c.roman}${c.notes ? ` — ${c.notes}` : ''}`).join('\n');
        const arr = (m.arrangement || [])
          .map(a => `${a.section} (${a.dynamics}): ${a.instrumentation}${a.production_detail ? ` → ${a.production_detail}` : ''}`).join('\n');
        fileText = [
          `243 MASTERS ENGINE REPORT`,
          `Title: ${m.title || topic || 'Untitled'}`,
          `Key: ${m.key || '—'} · BPM: ${m.bpm || '—'}`,
          m.masters_used?.length ? `Masters: ${m.masters_used.map(x => x.n).join(', ')}` : '',
          '',
          '── LYRICS ──',
          lyrics,
          '',
          '── CHORD PROGRESSION ──',
          chords,
          '',
          '── ARRANGEMENT ──',
          arr,
          '',
          '── PRODUCTION BRIEF ──',
          m.production_brief || '',
        ].filter(s => s !== null).join('\n');
      }
      const blob = new Blob([fileText], { type: 'text/plain' });
      const file = new File([blob], `${(mastersResult?.title || topic || 'lyrics')}.txt`, { type: 'text/plain' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const participation = calculateHumanParticipationScore({
        userProvidedContent: false,
        prompt: topic,
        styleOrTags: [...mood, ...style],
        personaOrTemplate: proMode || mastersMode || !!referenceArtists.trim(),
        isIteration: versions.length > 0,
      });
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'lyric',
        title: mastersResult?.title || topic || 'Untitled Lyrics',
        file_url,
        is_public: false,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
        metadata: {
          mood: mood.join(', '), style: style.join(', '), length, topic, content: lyrics,
          ...(isMasters && {
            masters_report: true,
            masters_brief: mastersResult.production_brief,
            masters_key: mastersResult.key,
            masters_bpm: mastersResult.bpm,
            masters_chord_progression: mastersResult.chord_progression,
            masters_arrangement: mastersResult.arrangement,
            masters_used: mastersResult.masters_used,
            content_hash: mastersResult.content_hash,
          }),
        },
      });
      toast.success(isMasters ? '👑 Full Masters report saved to library!' : 'Saved to library!');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const exportTxt = () => {
    const blob = new Blob([lyrics], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${topic || 'lyrics'}.txt`; a.click();
  };

  const exportToMusicStudio = async () => {
    if (!lyrics) { toast.error('No lyrics to export'); return; }
    setExporting(true);
    try {
      const user = await base44.auth.me();
      // Upload .txt + create UserAsset (same shape as saveLyrics — auto-save on export)
      const blob = new Blob([lyrics], { type: 'text/plain' });
      const file = new File([blob], `${topic || 'lyrics'}.txt`, { type: 'text/plain' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const participation = calculateHumanParticipationScore({
        userProvidedContent: false,
        prompt: topic,
        styleOrTags: [...mood, ...style],
        personaOrTemplate: proMode || mastersMode || !!referenceArtists.trim(),
        isIteration: versions.length > 0,
      });
      const asset = await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'lyric',
        title: topic || 'Untitled Lyrics',
        file_url,
        is_public: false,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
        metadata: { mood: mood.join(', '), style: style.join(', '), length, topic, content: lyrics },
      });
      toast.success('🎵 Saved & exporting to Music Studio…');
      // If we have a Masters brief, persist it on the asset metadata so Music Studio can pick it up
      if (mastersResult?.production_brief) {
        await base44.entities.UserAsset.update(asset.id, {
          metadata: {
            ...asset.metadata,
            masters_brief: mastersResult.production_brief,
            masters_key: mastersResult.key,
            masters_bpm: mastersResult.bpm,
            masters_chord_progression: mastersResult.chord_progression,
            masters_arrangement: mastersResult.arrangement,
            masters_used: mastersResult.masters_used,
          },
        }).catch(() => {});
      }
      const params = new URLSearchParams({
        tab: 'advanced',
        lyrics: asset.id,
        ...(style[0] && { genre: style[0] }),
        ...(topic && { topic }),
        ...(mastersResult?.production_brief && { masters: '1' }),
      });
      navigate(`/music-studio?${params.toString()}`);
    } catch (err) {
      toast.error(err.message);
      setExporting(false);
    }
  };

  const applyStructure = (tpl) => {
    if (lyrics) setVersions(v => [{ text: lyrics, timestamp: Date.now() }, ...v].slice(0, 5));
    setLyrics(tpl.text);
  };

  const restoreVersion = (v) => {
    if (lyrics) setVersions(vs => [{ text: lyrics, timestamp: Date.now() }, ...vs].slice(0, 5));
    setLyrics(v.text);
    toast.success('Version restored');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <div className="flex-1" />
        <button onClick={() => setShowShortcuts(p => !p)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-pink-500/30">
          <Keyboard className="w-3.5 h-3.5" /> Shortcuts ⌘K
        </button>
      </div>

      {/* Keyboard shortcuts panel */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-14 right-4 z-50 bg-card border border-border rounded-2xl p-4 shadow-2xl w-64">
            <p className="font-bold text-sm text-foreground mb-3 flex items-center gap-2"><Keyboard className="w-4 h-4" /> Keyboard Shortcuts</p>
            {[
              ['⌘ + Enter', 'Generate lyrics'],
              ['⌘ + S', 'Save to library'],
              ['⌘ + K', 'Toggle shortcuts'],
            ].map(([key, action]) => (
              <div key={key} className="flex justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{action}</span>
                <kbd className="bg-muted px-2 py-0.5 rounded text-foreground font-mono">{key}</kbd>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-pink-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎤 Lyrics Studio</h1>
          <p className="text-white/60 text-lg">Create original lyrics powered by AI. Real-time generation, version history & library save.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Panel */}
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
              <h3 className="font-black text-foreground flex items-center gap-2">
                Generation Settings
                <InfoTip size="sm" text="These settings control the AI lyrics engine. Pro Songwriter unlocks chart-grade rhyme craft + a writer-style auto-fill." />
              </h3>

              {/* Engine selector — Basic / Pro / Masters (one studio, three power levels) */}
              <EngineModeSelector
                mode={mastersMode ? 'masters' : proMode ? 'pro' : 'basic'}
                onChange={(m) => { setProMode(m === 'pro'); setMastersMode(m === 'masters'); }}
              />

              {/* Style-reference legal disclosure — shown whenever a reference-capable engine is on */}
              {(proMode || mastersMode) && <StyleReferenceDisclaimer />}

              {/* Pro-mode fields */}
              {proMode && (
                <div className="space-y-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                      <span>Writer / Reference Artist</span>
                      {writerProfile && (
                        <span className="normal-case text-[10px] font-bold text-amber-300">
                          ✓ {writerProfile.matched_name} ({writerProfile.confidence})
                        </span>
                      )}
                    </label>
                    <div className="flex gap-1.5">
                      <Input
                        value={referenceArtists}
                        onChange={e => { setReferenceArtists(e.target.value); setWriterProfile(null); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookupWriter(); } }}
                        onBlur={lookupWriter}
                        placeholder="e.g., Turnpike Troubadours, Tyler Childers"
                        className="rounded-xl bg-background flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={lookupWriter}
                        disabled={lookingUpWriter || !referenceArtists.trim()}
                        className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold px-3"
                        title="Auto-fill mood, style, rhyme & BPM from this writer"
                      >
                        {lookingUpWriter ? '…' : 'Auto'}
                      </Button>
                    </div>
                    <p className="text-[10px] text-amber-200/60 leading-tight">
                      Enter a writer's name — mood, style, rhyme & BPM auto-fill from their signature sound. Just add your topic.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">BPM <span className="text-muted-foreground/60 normal-case">(optional)</span></label>
                    <Input
                      type="number"
                      value={proBpm}
                      onChange={e => setProBpm(e.target.value)}
                      placeholder="e.g., 92"
                      min="40" max="220"
                      className="rounded-xl bg-background"
                    />
                  </div>

                  {/* Matched genre craft sheet */}
                  {matchedGenre && genreCraft && (
                    <div className="pt-2 border-t border-amber-500/20">
                      <button
                        type="button"
                        onClick={() => setShowCraftSheet(p => !p)}
                        className="w-full flex items-center justify-between text-xs text-amber-300 hover:text-amber-200"
                      >
                        <span className="font-bold">🎯 Applied: {matchedGenre}</span>
                        <span className="text-amber-300/60">{showCraftSheet ? 'Hide' : 'Show'} craft sheet</span>
                      </button>
                      <AnimatePresence>
                        {showCraftSheet && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden">
                            <div className="mt-2 space-y-1.5 text-[11px] text-amber-200/80 leading-relaxed">
                              {[
                                ['BPM', genreCraft.bpm_range],
                                ['Rhyme', genreCraft.rhyme],
                                ['Prosody', genreCraft.prosody],
                                ['Line length', genreCraft.line_length],
                                ['Vocabulary', genreCraft.vocabulary],
                                ['Avoid', genreCraft.avoid],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <span className="font-bold text-amber-300">{label}:</span> {value}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )}

              {/* Target music model — caps lyric budget per model */}
              <TargetModelSelect value={targetModel} onChange={setTargetModel} />

              {/* Topic */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  Topic / Theme
                  <InfoTip text="One concrete concept beats five vague ones. 'Long-distance love at 3 AM' produces sharper lyrics than 'love'." />
                </label>
                <Input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
                  placeholder="e.g., lost love, overcoming fears…" className="rounded-xl" />
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {TOPIC_SUGGESTIONS.map(s => (
                    <button key={s} type="button" onClick={() => setTopic(s)}
                      className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs hover:bg-pink-500/20 hover:text-pink-300 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Chips — multi-select */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  Mood
                  {mood.length > 0 && <span className="text-pink-400 font-bold">({mood.length})</span>}
                  <InfoTip text="Pick 1–3 moods. Stacking opposites (e.g. Melancholic + Triumphant) creates emotional contrast that hooks listeners." />
                </label>
                <MultiChipSelector
                  chipType="mood"
                  defaults={MOOD_CHIPS}
                  selected={mood}
                  onChange={setMood}
                  activeClass="bg-pink-600 text-white"
                  addLabel="Custom mood…"
                />
                {mood.length > 0 && (
                  <p className="text-xs text-pink-300/70">Mixed: {mood.join(' + ')}</p>
                )}
              </div>

              {/* Style Chips — multi-select */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  Style
                  {style.length > 0 && <span className="text-purple-400 font-bold">({style.length})</span>}
                  <InfoTip text="Genre shapes vocabulary, rhyme density and structure. Mixing styles (e.g. Hip-Hop + Pop) gives you a crossover feel." />
                </label>
                <MultiChipSelector
                  chipType="style"
                  defaults={STYLE_CHIPS}
                  selected={style}
                  onChange={setStyle}
                  activeClass="bg-purple-600 text-white"
                  addLabel="Custom style…"
                />
                {style.length > 0 && (
                  <p className="text-xs text-purple-300/70">Mixed: {style.join(' + ')}</p>
                )}
              </div>

              {/* Length Chips */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Length</label>
                <ChipSelector
                  chipType="duration"
                  defaults={LENGTHS}
                  selected={length}
                  onSelect={setLength}
                  activeClass="bg-pink-600 text-white"
                />
              </div>

              {/* Rhyme Scheme */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  Rhyme Scheme
                  <InfoTip text="Mixed = safest hit-song default. ABAB = pop alternating. AABB = punchy couplets. XAXA = modern/conversational. AAAA = tension builder." />
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {RHYME_SCHEMES.map(r => (
                    <button key={r.value} onClick={() => setRhymeScheme(r.value)}
                      className={`px-2.5 py-2 rounded-lg border text-left transition-all ${rhymeScheme === r.value ? 'border-pink-500 bg-pink-500/10' : 'border-border bg-muted/30 hover:border-pink-500/30'}`}>
                      <p className="text-xs font-black text-foreground">{r.label}</p>
                      <p className="text-xs text-muted-foreground leading-tight">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={generate} disabled={loading || !topic}
                className={`w-full rounded-xl font-bold gap-2 ${mastersMode ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-pink-600 hover:bg-pink-500'}`}>
                {mastersMode ? <Crown className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                {loading ? 'Generating…' : mastersMode ? 'Run Masters Engine (⌘↵)' : 'Generate  (⌘↵)'}
                <CostBadge cost={mastersMode ? 3 : 2} size="sm" />
              </Button>
            </div>

            {/* Structure Templates */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
              <h3 className="font-black text-foreground text-sm flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-pink-400" /> Structure Templates</h3>
              {STRUCTURE_TEMPLATES.map(t => {
                const isRedDirt = t.genre === 'Red Dirt';
                return (
                  <div key={t.label}>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { applyStructure(t); setStyle([t.genre]); }}
                        className="flex-1 text-left px-3 py-2 rounded-xl bg-muted text-sm text-muted-foreground hover:bg-pink-500/10 hover:text-pink-300 transition-all flex items-center justify-between gap-2">
                        <span>{t.label}</span>
                        <span className="text-xs text-muted-foreground/60 shrink-0">{t.genre}</span>
                      </button>
                      {isRedDirt && (
                        <button type="button"
                          onClick={() => setShowRedDirtInfo(p => !p)}
                          title="Red Dirt songwriting guide"
                          className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all border ${showRedDirtInfo ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-muted border-border text-muted-foreground hover:border-amber-500/30 hover:text-amber-300'}`}>
                          ?
                        </button>
                      )}
                    </div>

                    {/* Red Dirt Info Panel */}
                    <AnimatePresence>
                      {isRedDirt && showRedDirtInfo && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden">
                          <div className="mt-2 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-muted-foreground space-y-3">
                            <p className="font-bold text-amber-300 text-sm">🌵 Red Dirt Songwriting Guide</p>
                            <p className="text-amber-200/70">Typical bar structure — medium (16–32 bars) per section is standard for this genre.</p>

                            <div className="space-y-1.5">
                              <p className="font-semibold text-foreground">Typical Bar Structure</p>
                              {[
                                ['Verse', '16 bars (2 × 8-bar phrases) — detailed storytelling'],
                                ['Chorus', '8–16 bars — anthemic, high-energy hook'],
                                ['Bridge', '8 bars ("middle eight") — departure from V/C'],
                                ['Full Song', '60–90s for a verse-chorus-verse-chorus at mid-tempo'],
                              ].map(([section, detail]) => (
                                <div key={section} className="flex gap-2">
                                  <span className="text-amber-400 font-bold w-14 flex-shrink-0">{section}</span>
                                  <span>{detail}</span>
                                </div>
                              ))}
                            </div>

                            <div className="space-y-1.5 pt-1 border-t border-amber-500/10">
                              <p className="font-semibold text-foreground">Key Trends</p>
                              {[
                                'Storytelling Focus — longer verses (16–32 bars) for narrative depth',
                                '4/4 Time — 8- or 16-bar segments are the natural phrasing unit',
                                'Structure — V–C–V–C–Bridge–C balances familiarity & contrast',
                                'Style blend — rock, blues & folk; flexible but audience-focused',
                              ].map(tip => (
                                <p key={tip} className="flex gap-1.5"><span className="text-amber-400 flex-shrink-0">•</span>{tip}</p>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Version History */}
            {versions.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <h3 className="font-black text-foreground text-sm flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /> Version History</h3>
                {versions.map((v, i) => (
                  <button key={v.timestamp} type="button" onClick={() => restoreVersion(v)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-muted text-xs text-muted-foreground hover:bg-purple-500/10 hover:text-purple-300 transition-all truncate">
                    v{versions.length - i}: {v.text.slice(0, 40)}…
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Output Panel */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-2xl border border-border p-6 min-h-96 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-foreground">Your Lyrics</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(lyrics); toast.success('Copied!'); }}
                    disabled={!lyrics} className="rounded-xl h-8 gap-1.5 text-xs">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportTxt} disabled={!lyrics} className="rounded-xl h-8 gap-1.5 text-xs">
                    <Download className="w-3.5 h-3.5" /> .txt
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-pink-500/10 border border-pink-500/20">
                    <div className="w-4 h-4 border-2 border-pink-500/30 border-t-pink-500 rounded-full animate-spin flex-shrink-0" />
                    <p className="text-xs text-pink-300">AI is writing your lyrics…</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <Textarea ref={textareaRef} value={lyrics} onChange={e => setLyrics(e.target.value)}
                onFocus={showCharLimitNotice}
                placeholder={`Your lyrics will appear here after generation.\n\nTip: Use ⌘+Enter to generate, ⌘+S to save.`}
                className="w-full h-96 rounded-xl font-mono text-sm resize-none" />

              {/* Live per-model compatibility check against the selected target model */}
              <LyricsCompatibilityCheck lyrics={debouncedLyrics} provider={tmProvider} model={tmModel} mode="song" />

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={generate} disabled={loading || !topic} className="rounded-xl gap-1.5 text-sm">
                  <RefreshCw className="w-4 h-4" /> Regenerate
                </Button>
                <Button onClick={saveLyrics} disabled={saving || !lyrics}
                  className="bg-pink-600 hover:bg-pink-500 rounded-xl gap-1.5 text-sm font-bold">
                  <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save (⌘S)'}
                </Button>
                <Button onClick={exportToMusicStudio} disabled={exporting || !lyrics}
                  className="bg-blue-600 hover:bg-blue-500 rounded-xl gap-1.5 text-sm font-bold">
                  <Music className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Send to Music Studio →'}
                </Button>
              </div>
            </div>

            {/* 243 Masters brief panel — chord progression, arrangement, production brief */}
            {mastersResult && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-end">
                  <Button onClick={saveLyrics} disabled={saving || !lyrics}
                    className="bg-amber-500 hover:bg-amber-400 text-black rounded-xl gap-1.5 text-xs font-bold h-8">
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Full Report'}
                  </Button>
                </div>
                <MastersBriefDisplay result={mastersResult} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}