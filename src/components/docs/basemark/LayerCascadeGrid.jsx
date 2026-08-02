const LAYERS = [
  {
    name: 'V1 — Spectral Layer',
    carries: 'Full 32-bit registry payload',
    engine: 'In-house spread-spectrum DSP',
    when: 'Instant, synchronous on save',
    strengths:
      'Deterministic and GPU-free — embeds in the same request that saves the track, and is cheap enough to verify at scale. Measured 100% recovery through band-limiting, 8-bit quantization and noise down to 10dB SNR.',
    weaknesses:
      'Broken outright by pitch-shifting or time-stretching on a normal scan (0% recovery measured). Clips under ~3s are declined rather than answered.',
  },
  {
    name: 'V2 — Neural Layer',
    carries: 'Full 32-bit registry payload',
    engine: 'Based on SilentCipher (Singh et al., Interspeech 2024), on our own private deployment',
    when: 'Async on a private GPU, automatic after V1',
    strengths:
      'Trained against compression, time-jittering and additive noise, and it resolves independently of V1 — so a scan still returns the payload when the spectral layer is stripped or the file is re-encoded.',
    weaknesses:
      'Cold starts can take minutes and detection costs real compute per scan. It does not rescue pitch-shifted or time-stretched audio — measured 0%, same as V1.',
  },
  {
    name: 'V3 — Drift Layer',
    carries: '16-bit slot pointer (not the payload)',
    engine: 'Based on WavMark, on our own private deployment',
    when: 'Opt-in per asset, chained after V2',
    strengths:
      'Recovers from very short excerpts, which is where the spectral layer abstains: measured 100% slot recovery from 2s, 3s and 5s crops, and through 15kHz/11kHz band-limiting, 8-bit quantization and 20dB-SNR noise.',
    weaknesses:
      'It does NOT close the re-timing gap it was built for. Measured standalone on clean audio: 0% recovery under every pitch shift tested (±1 and +2 semitones, +37 cents, 44.1/48kHz mishandling), 0% under ±5% time stretch, and 0% at 10dB SNR. Only 16 usable bits, so it points at an asset rather than carrying the payload, and the pool ceilings at 65,536 concurrent slots.',
  },
];

export default function LayerCascadeGrid() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold text-foreground mb-1">Why three layers instead of one?</p>
        <p className="text-muted-foreground">
          The three layers are different technologies with different failure modes, so stacking them
          gives forensic redundancy: an attack that defeats one usually leaves another intact. Order is
          forced — V1, then V2, then V3 — because V1 sprays broadband noise across the band V3 uses as
          its carrier, so V3 must always go last. One important exception to the redundancy claim:
          benchmarking shows all three layers share the SAME blind spot for pitch-shifted and
          time-stretched audio, so stacking does not help there. That gap is real and is not solved by
          adding layers.
        </p>
      </div>
      <div className="grid lg:grid-cols-3 gap-3">
        {LAYERS.map((l) => (
          <div key={l.name} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="font-semibold text-foreground text-sm">{l.name}</p>
            <dl className="space-y-1 text-[11.5px]">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground/70 shrink-0">Carries:</dt>
                <dd className="text-[#FFC98A]">{l.carries}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground/70 shrink-0">Engine:</dt>
                <dd className="text-muted-foreground">{l.engine}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground/70 shrink-0">Runs:</dt>
                <dd className="text-muted-foreground">{l.when}</dd>
              </div>
            </dl>
            <p className="text-muted-foreground text-xs">
              <strong className="text-emerald-400">Strengths:</strong> {l.strengths}
            </p>
            <p className="text-muted-foreground text-xs">
              <strong className="text-[#FFC98A]">Weaknesses:</strong> {l.weaknesses}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}