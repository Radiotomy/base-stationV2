const OPTIONS = [
  { value: 'human', label: 'Human-made', hint: 'Written and voiced by people. No generative AI in the recording.' },
  { value: 'ai_assisted', label: 'AI-assisted', hint: 'Mostly human, with some AI elements (e.g. an AI voice segment).' },
  { value: 'ai_generated', label: 'AI-generated', hint: 'AI produced the whole or primary part of the audio.' },
];

/**
 * Creator attestation of how an episode was made.
 * This is the authoritative origin signal — the platform does not run an
 * AI-speech classifier, so origin must be declared rather than guessed.
 */
export default function OriginAttestation({ value, onChange, disabled }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">
        How was this made? *
      </label>
      <div className="space-y-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`w-full text-left rounded-xl border p-3 transition-all disabled:opacity-50 ${
              value === o.value
                ? 'border-[#FF9A4D] bg-[#FF9A4D]/10'
                : 'border-white/10 bg-black/20 hover:border-white/25'
            }`}
          >
            <p className={`text-sm font-bold ${value === o.value ? 'text-[#FF9A4D]' : 'text-white'}`}>{o.label}</p>
            <p className="text-xs text-white/50 mt-0.5">{o.hint}</p>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-white/40 mt-2">
        Your answer sets the episode's disclosure label. We never infer AI use from missing data.
      </p>
    </div>
  );
}