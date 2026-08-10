import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles, Users, Quote, Smile, Tags } from 'lucide-react';

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * EpisodeIntelligencePanel — AssemblyAI transcript intelligence for a finished
 * episode: speaker diarization, key moments, sentiment mix and topics.
 * Owner-only; complements (does not duplicate) the Inworld synthesis side.
 */
export default function EpisodeIntelligencePanel({ episode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const run = async () => {
    setBusy(true);
    setError('');
    const res = await base44.functions
      .invoke('analyzeEpisode', { audio_url: episode.audio_url, episode_id: episode.id })
      .catch((e) => ({ data: { error: e.message } }));
    setBusy(false);
    const data = res?.data || {};
    if (data.error) return setError(data.error);
    if (data.status === 'processing') return setError('Still analyzing — try again in a moment.');
    setResult(data);
  };

  return (
    <div className="merc-card rounded-2xl p-5 mt-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D]">Episode Intelligence</p>
          <p className="text-[11px] text-white/40 mt-0.5">Speakers, key moments, sentiment and topics.</p>
        </div>
        <button
          onClick={run}
          disabled={busy || !episode.audio_url}
          className="merc-button rounded-full px-4 py-2 text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {busy ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="space-y-4 mt-2">
          <div>
            <p className="text-[11px] font-bold text-white/50 flex items-center gap-1.5 mb-1.5">
              <Users className="w-3.5 h-3.5" /> Speakers detected: {result.speakers?.length || 0}
            </p>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {(result.utterances || []).map((u, i) => (
                <p key={i} className="text-xs text-white/70">
                  <span className="text-[#FF9A4D] font-bold">Speaker {u.speaker}</span>
                  <span className="text-white/30"> · {fmt(u.start_seconds)}</span> — {u.text}
                </p>
              ))}
            </div>
          </div>

          {result.highlights?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-white/50 flex items-center gap-1.5 mb-1.5">
                <Quote className="w-3.5 h-3.5" /> Key moments
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.highlights.map((h) => (
                  <span key={h.text} className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-white/70">{h.text}</span>
                ))}
              </div>
            </div>
          )}

          {result.sentiment && (
            <p className="text-[11px] font-bold text-white/50 flex items-center gap-1.5">
              <Smile className="w-3.5 h-3.5" /> Sentiment — positive {result.sentiment.positive} · neutral{' '}
              {result.sentiment.neutral} · negative {result.sentiment.negative}
            </p>
          )}

          {result.topics?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-white/50 flex items-center gap-1.5 mb-1.5">
                <Tags className="w-3.5 h-3.5" /> Topics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.topics.map((t) => (
                  <span key={t.label} className="text-[11px] px-2 py-0.5 rounded bg-[#FF9A4D]/15 text-[#FF9A4D]">{t.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}