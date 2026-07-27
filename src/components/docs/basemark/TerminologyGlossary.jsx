import { BookOpen } from 'lucide-react';

const BASE_MARK_TERMS = [
  { term: 'Spread-Spectrum Watermarking', def: 'The embedding family BASE Mark uses — the payload is spread across many samples as low-amplitude pseudo-random chips, making it statistically invisible without the key.' },
  { term: 'Payload', def: 'The 32-bit identifier embedded in the audio, derived from the asset ID via FNV-1a hashing, matched against the BASE Station registry on detection.' },
  { term: 'Pilot Signal', def: 'A known reference segment at the start of every block, used to recover block alignment after arbitrary cuts by scanning every sample offset.' },
  { term: 'Chip Sequence', def: 'The deterministic pseudo-random ±1 pattern (seeded per platform + bit position) that carries each payload bit, added ~−24 dB below local RMS.' },
  { term: 'Majority Voting', def: 'Each payload bit is decoded from every surviving block and the most common value wins — errors in individual blocks are outvoted.' },
  { term: 'Localization', def: 'The full payload repeats every ~0.77s block, so any contiguous surviving chunk ≥ ~2s carries the complete identifier — inspired by AudioSeal and WavMark research.' },
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
      <TermList title="Audio watermarking field terms" terms={FIELD_TERMS} />
    </section>
  );
}