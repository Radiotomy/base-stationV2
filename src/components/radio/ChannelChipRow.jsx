/**
 * Horizontal scrolling row of backlit lime-green channel preset chips
 * with signal-strength bars — Boombox faceplate preset strip.
 */
function SignalBars({ active, playing }) {
  return (
    <span className="flex items-end gap-[2px] h-3 flex-shrink-0" aria-hidden>
      {[3, 6, 9, 12].map((h, i) => (
        <span key={i}
          className={`w-[3px] rounded-sm ${active ? "bg-[#C6F27E]" : "bg-[#C6F27E]/35"} ${active && playing ? "animate-pulse" : ""}`}
          style={{ height: `${h}px`, animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}

export default function ChannelChipRow({ channels, activeChannel, isPlaying, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1.5 snap-x scrollbar-hide">
      {channels.map((ch) => {
        const isActive = activeChannel.id === ch.id || activeChannel.slug === ch.slug;
        return (
          <button key={ch.id || ch.slug} onClick={() => onSelect(ch)}
            className={`snap-start flex-shrink-0 flex items-center gap-2 rounded-full pl-3 pr-3.5 py-2 border transition-all
              ${isActive
                ? "bg-[#1B2410] border-[#FF9A4D]/70 shadow-[0_0_10px_rgba(255,154,77,0.25),inset_0_0_12px_rgba(198,242,126,0.08)]"
                : "bg-[#131A0C] border-[#C6F27E]/15 hover:border-[#C6F27E]/40 active:bg-[#1B2410]"}`}>
            <span className="text-sm leading-none">{ch.emoji || "🎵"}</span>
            <span className={`text-xs font-semibold whitespace-nowrap ${isActive ? "text-[#E4FCA8]" : "text-[#A8C97E]"}`}
              style={{ textShadow: isActive ? "0 0 6px rgba(198,242,126,0.5)" : "none" }}>
              {ch.name}
            </span>
            <SignalBars active={isActive} playing={isPlaying} />
          </button>
        );
      })}
    </div>
  );
}