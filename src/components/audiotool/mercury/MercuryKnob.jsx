/** Decorative milled knob with an amber pointer, rotated by `value` (0–1). */
export default function MercuryKnob({ value = 0.5, label }) {
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className="rack-knob" style={{ transform: `rotate(${-135 + value * 270}deg)` }} aria-hidden="true" />
      {label && <span className="rack-readout text-[9px]">{label}</span>}
    </span>
  );
}