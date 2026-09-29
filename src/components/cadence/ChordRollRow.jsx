import { chordColor, triadName } from '@/lib/chords/chordSymbols';

/** One horizontal chord lane; segments positioned by time over the bed's duration. */
export default function ChordRollRow({ label, segments, duration, onSeek }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="relative h-9 rounded-md overflow-hidden bg-black/40">
        {segments.map((s, i) => (
          <button key={i} type="button" onClick={() => onSeek(s.start)}
            title={`${s.chord?.label || triadName(s.chord)} · ${s.start.toFixed(1)}s`}
            className="absolute inset-y-0 border-r border-black/50 text-[10px] font-semibold text-white/90 truncate px-1 text-left"
            style={{ left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%`, background: chordColor(s.chord) }}>
            {triadName(s.chord)}
          </button>
        ))}
      </div>
    </div>
  );
}