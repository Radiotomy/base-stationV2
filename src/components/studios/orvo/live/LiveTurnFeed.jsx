import { useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';

/**
 * Shows every co-host turn as it lands and auto-plays the newest one so the
 * room hears the session unfold together.
 */
export default function LiveTurnFeed({ turns, autoPlay }) {
  const playedRef = useRef(new Set());
  const audioRef = useRef(null);

  useEffect(() => {
    if (!autoPlay || turns.length === 0) return;
    const latest = turns[turns.length - 1];
    if (!latest.audio_url || playedRef.current.has(latest.id)) return;
    playedRef.current.add(latest.id);
    if (audioRef.current) {
      audioRef.current.src = latest.audio_url;
      audioRef.current.play().catch(() => {});
    }
  }, [turns, autoPlay]);

  return (
    <div className="space-y-3">
      <audio ref={audioRef} className="hidden" />
      {turns.length === 0 && (
        <p className="text-sm text-white/40">Nothing on air yet — the co-host's turns will appear here.</p>
      )}
      {turns.map((t) => (
        <div key={t.id} className="merc-card rounded-xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#FF9A4D] mb-1.5 flex items-center gap-1">
            <Volume2 className="w-3 h-3" /> AI co-host
          </p>
          <p className="text-sm text-white/80 whitespace-pre-wrap">{t.text}</p>
          {t.audio_url && <audio src={t.audio_url} controls className="w-full mt-3 h-9" />}
        </div>
      ))}
    </div>
  );
}