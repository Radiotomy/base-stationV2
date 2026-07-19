import RadioTip from "@/components/radio/RadioTip";

/**
 * Circular machined-knob transport button with tick ring + label.
 */
export default function TransportKnob({ icon: Icon, label, tip, onClick, disabled, primary = false, spinning = false }) {
  const size = primary ? "w-[68px] h-[68px]" : "w-14 h-14";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <RadioTip tip={tip || label}>
      <button onClick={onClick} disabled={disabled} aria-label={label} title={disabled ? (tip || label) : undefined}
        className={`relative ${size} rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40
          bg-[radial-gradient(circle_at_35%_30%,#3A322A_0%,#1C1712_55%,#0C0906_100%)]
          border border-black/80
          shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),inset_0_-3px_6px_rgba(0,0,0,0.7),0_4px_12px_rgba(0,0,0,0.7)]`}>
        {/* Tick ring */}
        {[...Array(12)].map((_, i) => (
          <span key={i} className={`absolute w-[2px] h-[5px] rounded ${primary ? "bg-[#FF9A4D]/70" : "bg-white/20"}`}
            style={{ transform: `rotate(${i * 30}deg) translateY(${primary ? "-31px" : "-25px"})` }} />
        ))}
        <Icon className={`${primary ? "w-6 h-6" : "w-5 h-5"} text-[#E8DFD2] ${spinning ? "animate-spin" : ""}`} />
      </button>
      </RadioTip>
      <span className="text-[11px] text-[#B8A990] font-medium">{label}</span>
    </div>
  );
}