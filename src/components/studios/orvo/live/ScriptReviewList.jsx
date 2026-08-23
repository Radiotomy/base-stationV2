import { CheckCircle2, Clock, AlertTriangle, Radio } from 'lucide-react';

const mmss = (s) => `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String(Math.round((s || 0) % 60)).padStart(2, '0')}`;

/** The running order, with each segment's render state and on-air position. */
export default function ScriptReviewList({ script, cast, onEditSegment, editable }) {
  const nameOf = (id) => cast?.find((c) => c.persona_id === id)?.name || id;

  const icon = (s) => {
    if (s.status === 'failed') return <AlertTriangle className="w-3 h-3 text-red-400" />;
    if (s.status === 'aired') return <Radio className="w-3 h-3 text-red-400" />;
    if (s.audio_url) return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
    return <Clock className="w-3 h-3 text-white/30" />;
  };

  return (
    <div className="space-y-2">
      {script.map((s) => (
        <div key={s.index} className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {icon(s)}
            <span className="text-[11px] font-black text-[#FFC98A]">{nameOf(s.persona_id)}</span>
            <span className="text-[10px] uppercase tracking-wider text-white/35">{s.segment_type?.replace('_', ' ')}</span>
            <span className="text-[10px] text-white/30 ml-auto">{mmss(s.start_seconds)} · {s.seconds}s</span>
          </div>

          {editable ? (
            <textarea
              value={s.text}
              onChange={(e) => onEditSegment?.(s.index, e.target.value)}
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9A4D]/60"
            />
          ) : (
            <p className="text-xs text-white/70 whitespace-pre-wrap">{s.text}</p>
          )}

          {s.error && <p className="text-[11px] text-red-300 mt-1.5">{s.error}</p>}
          {s.audio_url && <audio src={s.audio_url} controls className="w-full mt-2 h-8" />}
        </div>
      ))}
    </div>
  );
}