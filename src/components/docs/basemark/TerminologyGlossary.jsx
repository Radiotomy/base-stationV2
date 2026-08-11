import { BookOpen } from 'lucide-react';

const BASE_MARK_TERMS = [
  { term: 'Spread-Spectrum Watermarking', def: 'The embedding family BASE Mark uses — the payload is spread across many samples as low-amplitude pseudo-random chips, making it statistically invisible without the key.' },
  { term: 'Payload', def: 'The 32-bit identifier embedded in the audio, derived from the asset ID via FNV-1a hashing, matched against the BASE Station registry on detection.' },
  { term: 'Pilot Signal', def: 'A known reference segment at the start of every block, used to recover block alignment after arbitrary cuts by scanning every sample offset.' },
  { term: 'Chip Sequence', def: 'The deterministic pseudo-random ±1 pattern (seeded per platform + bit position) that carries each payload bit, added ~−24 dB below local RMS.' },
  { term: 'Majority Voting', def: 'Each payload bit is decoded from every surviving block and the most common value wins — errors in individual blocks are outvoted.' },
  { term: 'Localization', def: 'The full payload repeats every ~0.77s block, so any contiguous surviving chunk ≥ ~2s carries the complete identifier — inspired by AudioSeal and WavMark research.' },
];

const CASCADE_TERMS = [
  { term: 'Cascade', def: 'The stack of watermark layers carried by one file. Production is a two-layer funnel: V1 spectral embedded first, then V2 neural layered on top of that file, so the shipped master carries both and either can resolve alone.' },
  { term: 'Drift Layer (V3) — retired', def: 'A WavMark-based layer intended to cover re-timed audio. Decommissioned August 2026 after measuring 0% against every re-timing attack tested. Pre-flight audit found zero allocated slots and zero marked assets, so no identity was lost. Kept in the glossary so historic benchmark rows still read correctly.' },
  { term: 'Slot — retired', def: 'The 16-bit pointer V3 embedded in place of the 32-bit payload, resolved back to an asset by the registry. Removed with the layer; no production file ever carried one.' },
  { term: 'Deep Scan', def: 'A detection-time search that re-times suspect audio by inverse ratios to undo resampling. Recovers exact-ratio shifts (whole semitones, 44.1/48kHz mishandling) at 100%; arbitrary shifts and tempo stretches remain unrecoverable.' },
  { term: 'Abstention', def: 'The detector returning "insufficient evidence" instead of a low-confidence guess. Thresholds scale with the amount of audio supplied, and below roughly 3 seconds no payload is returned at all.' },
];

const FIELD_TERMS = [
  { term: 'Blind Watermarking', def: 'Embedding and extraction without access to the original host signal. BASE Mark detection is fully blind — only the file under test is needed.' },
  { term: 'Imperceptibility', def: 'The degree to which the embedded watermark remains inaudible to human listeners.' },
  { term: 'Robustness', def: 'The watermark\u2019s ability to withstand common signal-processing attacks (cutting, re-encoding, mixing) without loss of embedded information.' },
  { term: 'Psychoacoustic Masking', def: 'Exploiting human auditory thresholds to conceal watermark signals beneath perceptual noise floors — BASE Mark scales chip amplitude to the local RMS so the mark hides under the music itself.' },
  { term: 'Discrete Wavelet Transform (DWT)', def: 'A multiresolution transform that decomposes audio into subbands aligned with critical frequency ranges. Used by transform-domain watermarking schemes; BASE Mark\u2019s spectral layer operates in the time domain instead.' },
  { term: 'Quantization Index Modulation (QIM)', def: 'A data-embedding method that alters quantization steps of transform coefficients to encode watermark bits — an alternative embedding family to spread-spectrum.' },
  { term: 'Singular Value Decomposition (SVD)', def: 'A matrix factorisation used to embed watermarks in the singular values of transform coefficient matrices, prized for stability under compression.' },
];

function TermList({ title, terms }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <dl className="space-y-3">
        {terms.map((t) => (
          <div key={t.term} className="rounded-lg border border-border bg-card p-4">
            <dt className="text-sm font-semibold text-[#FFC98A] mb-1">{t.term}</dt>
            <dd className="text-[12.5px] text-muted-foreground leading-relaxed">{t.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function TerminologyGlossary() {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-[#FF9A4D]" />
        <h2 className="font-display text-lg">Terminology</h2>
      </div>
      <TermList title="BASE Mark concepts (Spectral Layer)" terms={BASE_MARK_TERMS} />
      <TermList title="Cascade & detection concepts" terms={CASCADE_TERMS} />
      <TermList title="Audio watermarking field terms" terms={FIELD_TERMS} />
    </section>
  );
}