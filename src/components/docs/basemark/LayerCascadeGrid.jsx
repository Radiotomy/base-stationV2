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
    name: 'V3 — Drift Layer (RETIRED)',
    carries: 'Nothing — decommissioned 2026-08',
    engine: 'Was WavMark-based; deployments and secrets removed',
    when: 'Never on the default path; now fully removed from the funnel',
    strengths:
      'Its one measured advantage was short-excerpt coverage (100% slot recovery from 2s crops, where the spectral layer abstains). That advantage never reached production.',
    weaknesses:
      'Retired after failing the gap it was built for: 0% recovery under every pitch shift and time stretch tested. Pre-flight audit before removal found 0 allocated slots and 0 assets carrying V3 metadata in any state, so no identity was ever recoverable through it. Retained here for the record only — see BASE_MARK_V3_ARCHIVE.md for the rebuild path.',
  },
  {
    name: 'V4 — Speed Layer',
    carries: 'Full 32-bit registry payload',
    engine: 'Based on audiowmark (Westerfeld), on our own private CPU deployment',
    when: 'Under active benchmarking — not yet on the default path',
    strengths:
      'The only layer measured to recover re-timed audio: it estimates the playback ratio from the signal, re-times, then decodes — recovering the payload under a one-semitone resample and 44.1/48kHz mishandling, where all three other layers measure 0%. Carries the payload whole (no slot pointer, no capacity ceiling), marks the master at full rate in stereo, and runs CPU-only, so there is no GPU cold start. Survived real MP3, AAC and Opus round trips at 128k, including stacked on top of a pitch shift.',
    weaknesses:
      'Codec damage consumes most of the decision margin, so acceptance depends on a bit-error threshold rather than a clean pass/fail. Still 0% against pitch-preserved tempo stretching and against crops under roughly 5 seconds. Figures so far are n=1 on a single master at one bitrate — early, and still being measured.',
  },
  {
    name: 'Print Layer — Fingerprint',
    carries: 'Nothing — identifies by similarity, not payload',
    engine: 'In-house scale-invariant landmark fingerprint',
    when: 'In measurement — admin-only, not on any production path',
    strengths:
      'Not a watermark: hashes are built from frequency and time ratios, so the print survives the exact attacks that defeat every embedded layer — pitch shifts and pitch-preserved tempo stretches. Beyond identifying a re-timed copy, it estimates the warp factor, which seeds a targeted spectral recovery: measured exact-payload recovery on every re-timing cell tested across seven masters, with zero false positives in null runs.',
    weaknesses:
      'Identification only — a print match recovers no payload and asserts similarity, not provenance, so it can never back an attribution alone. The ratio estimate varies from ~7 to over 1,200 ppm of error against a ~20 ppm-wide recovery peak, and the search-budget calibration that bridges that gap is still open.',
  },
];

export default function LayerCascadeGrid() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold text-foreground mb-1">Why several layers instead of one?</p>
        <p className="text-muted-foreground">
          Each layer is a different technology with a different failure mode, so stacking them gives
          forensic redundancy: an attack that defeats one usually leaves another intact. Production is now a
          two-layer funnel — V1 spectral, then V2 neural — after the V3 Drift Layer was decommissioned in
          August 2026 for failing the re-timing gap it existed to close (it had zero production adoption and
          zero recoverable identities, so removing it cost nothing). V1 and V2 share the SAME blind spot for
          re-timed audio, and stacking them does not help there; that is exactly why the V4 Speed Layer was built, and it is
          the first layer measured to recover a resampled file. The remaining shared gap —
          pitch-<em>preserved</em> tempo stretching — is not solved by any watermark layer, and we do not
          claim otherwise; the Print Layer fingerprint (below) is how a stretched copy is identified,
          because its ratio-based hashes survive where every embedded payload does not.
        </p>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
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