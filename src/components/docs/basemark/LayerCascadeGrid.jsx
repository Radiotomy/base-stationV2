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
    engine: 'SilentCipher (Singh et al., Interspeech 2024)',
    when: 'Async on a private GPU, automatic after V1',
    strengths:
      'Trained against compression, time-jittering and additive noise, and it resolves independently of V1 — so a scan still returns the payload when the spectral layer is stripped or the file is re-encoded.',
    weaknesses:
      'Cold starts can take minutes and detection costs real compute per scan. It does not rescue pitch-shifted or time-stretched audio — measured 0%, same as V1.',
  },
  {
    name: 'V3 — Drift Layer',
    carries: '16-bit slot pointer (not the payload)',
    engine: 'WavMark, on our own private deployment',
    when: 'Opt-in per asset, chained after V2',
    strengths:
      'Targets the gap the other two share: re-timed and re-recorded audio. WavMark carries a low-band delta rather than broadband noise, so it survives handling that desynchronizes the chip-aligned spectral layer.',
    weaknesses:
      'Only 16 usable bits, so it points at an asset instead of carrying the registry payload — and the pool ceilings at 65,536 concurrent slots. Full-length throughput is still unproven, so it is not yet automatic on save.',
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
          its carrier, so V3 must always go last.
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