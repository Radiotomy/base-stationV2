/**
 * Vertical frequency-band channel selector for the Transport Unit.
 * Backlit green preset buttons with signal-strength bars.
 */
function SignalBars({ active, playing }) {
  return (
    <span className="flex items-end gap-[2px] h-3.5 flex-shrink-0" aria-hidden>
      {[4, 7, 10, 14].map((h, i) => (
        <span key={i}
          className={`w-[3px] rounded-sm ${active ? "bg-[#C6F27E]" : "bg-[#C6F27E]/35"} ${active && playing ? "animate-pulse" : ""}`}
          style={{ height: `${h}px`, animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}

export default function ChannelSelector({ channels, activeChannel, isPlaying, onSelect }) {
  return (
    <div className="rounded-xl border border-black/70 bg-[#0B0906] p-2.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
      <div className="space-y-2 max-h-[340px] overflow-y-auto overscroll-contain pr-0.5">
        {channels.map((ch, idx) => {
          const isActive = activeChannel.id === ch.id || activeChannel.slug === ch.slug;
          return (
            <div key={ch.id || ch.slug} className="relative">
              {isActive && (
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-full hidden lg:flex w-5 h-5 rounded-full bg-[#FF9A4D] text-[#14100C] text-[10px] font-black items-center justify-center shadow-[0_0_8px_rgba(255,154,77,0.6)]">
                  {idx + 1}
                </span>
              )}
              <button onClick={() => onSelect(ch)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all border
                  ${isActive
                    ? "bg-[#1B2410] border-[#FF9A4D]/70 shadow-[0_0_10px_rgba(255,154,77,0.25),inset_0_0_12px_rgba(198,242,126,0.08)]"
                    : "bg-[#131A0C] border-[#C6F27E]/15 hover:border-[#C6F27E]/40 active:bg-[#1B2410]"}`}>
                <span className="text-base leading-none flex-shrink-0">{ch.emoji || "🎵"}</span>
                <span className={`flex-1 min-w-0 truncate text-sm font-semibold ${isActive ? "text-[#E4FCA8]" : "text-[#A8C97E]"}`}
                  style={{ textShadow: isActive ? "0 0 6px rgba(198,242,126,0.5)" : "none" }}>
                  {ch.name}
                </span>
                <SignalBars active={isActive} playing={isPlaying} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}