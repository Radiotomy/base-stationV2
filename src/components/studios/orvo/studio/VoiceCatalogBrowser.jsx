import { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Play, Square, Check } from 'lucide-react';

const chip = (active) =>
  `px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
    active
      ? 'text-[#2A1508] border-black bg-gradient-to-b from-[#FFC26E] to-[#FF9A4D]'
      : 'text-white/60 border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] hover:text-[#FF9A4D]'
  }`;

/**
 * VoiceCatalogBrowser — live per-provider voice catalog with search, filters
 * and in-place auditioning, so a voice is chosen by ear rather than by ID.
 */
export default function VoiceCatalogBrowser({ provider, voiceId, onVoiceIdChange, disabled = false }) {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState('all');
  const [gender, setGender] = useState('all');
  const [previewing, setPreviewing] = useState('');
  const [playingId, setPlayingId] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setVoices([]);
    base44.functions
      .invoke('listVoices', { provider })
      .then((res) => {
        if (!alive) return;
        if (res.data?.error) setError(res.data.error);
        else setVoices(res.data?.voices || []);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [provider]);

  // Stop any audition when the provider changes or the browser unmounts
  useEffect(() => () => audioRef.current?.pause(), [provider]);

  const languages = useMemo(
    () => Array.from(new Set(voices.map((v) => v.language).filter(Boolean))).sort(),
    [voices]
  );
  const genders = useMemo(
    () => Array.from(new Set(voices.map((v) => v.gender).filter(Boolean))).sort(),
    [voices]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return voices.filter((v) => {
      if (lang !== 'all' && v.language !== lang) return false;
      if (gender !== 'all' && v.gender !== gender) return false;
      if (!q) return true;
      return `${v.name} ${v.description} ${v.accent} ${v.use_case} ${v.age}`.toLowerCase().includes(q);
    });
  }, [voices, query, lang, gender]);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId('');
  };

  const play = (url, id) => {
    stop();
    const el = new Audio(url);
    el.onended = () => setPlayingId('');
    audioRef.current = el;
    setPlayingId(id);
    el.play();
  };

  const audition = async (v) => {
    if (playingId === v.id) return stop();
    if (v.preview_url) return play(v.preview_url, v.id);
    setPreviewing(v.id);
    const res = await base44.functions
      .invoke('previewVoice', { provider, voice_id: v.id })
      .catch((e) => ({ data: { error: e.message } }));
    setPreviewing('');
    if (res.data?.audio_data_url) play(res.data.audio_data_url, v.id);
    else setError(res.data?.error || 'Preview failed');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, style, accent or use case…"
          className="sm:flex-1"
        />
        <p className="text-[11px] text-white/40 self-center whitespace-nowrap">
          {filtered.length} of {voices.length} voices
        </p>
      </div>

      {(languages.length > 1 || genders.length > 1) && (
        <div className="flex flex-wrap gap-1.5">
          {languages.length > 1 && (
            <>
              <button onClick={() => setLang('all')} className={chip(lang === 'all')}>All languages</button>
              {languages.map((l) => (
                <button key={l} onClick={() => setLang(l)} className={chip(lang === l)}>{l}</button>
              ))}
            </>
          )}
          {genders.length > 1 && (
            <>
              <span className="w-px self-stretch bg-black/60 mx-1" />
              <button onClick={() => setGender('all')} className={chip(gender === 'all')}>Any</button>
              {genders.map((g) => (
                <button key={g} onClick={() => setGender(g)} className={chip(gender === g)}>{g}</button>
              ))}
            </>
          )}
        </div>
      )}

      {loading && (
        <p className="text-white/50 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading voice catalog…
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
          {filtered.map((v) => {
            const selected = voiceId === v.id;
            return (
              <div
                key={v.id}
                className={`rounded-lg border p-3 flex items-start gap-3 ${
                  selected ? 'border-[#FF9A4D] bg-[#FF9A4D]/10' : 'border-black/60 bg-[#1A1410]'
                }`}
              >
                <button
                  onClick={() => audition(v)}
                  disabled={disabled || previewing === v.id}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-b from-[#FFC26E] to-[#FF9A4D] text-[#2A1508] flex-shrink-0 disabled:opacity-50"
                  title="Preview this voice"
                >
                  {previewing === v.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : playingId === v.id ? (
                    <Square className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{v.name}</p>
                  {v.description && <p className="text-[11px] text-white/50 line-clamp-2">{v.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {[v.language, v.gender, v.age, v.accent, v.use_case]
                      .filter(Boolean)
                      .map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                          {String(tag).replace(/_/g, ' ')}
                        </span>
                      ))}
                  </div>
                </div>
                <button
                  onClick={() => onVoiceIdChange?.(v.id)}
                  disabled={disabled}
                  className={chip(selected)}
                >
                  {selected ? <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Selected</span> : 'Use'}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-white/40 text-sm">No voices match those filters.</p>}
        </div>
      )}
    </div>
  );
}