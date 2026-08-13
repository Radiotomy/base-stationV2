const PRESETS = [
  { v: null, label: 'Fade' },
  { v: 'ascend', label: 'Ascend' },
  { v: 'shift', label: 'Shift' },
  { v: 'typewriter', label: 'Typewriter' },
];

/** Animation style for a scene's on-screen text (Shotstack rich-text presets). */
export default function TextAnimationPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 flex-wrap pl-4">
      <span className="text-[10px] text-muted-foreground mr-0.5">Animate:</span>
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onChange(p.v)}
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
            (value || null) === p.v
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}