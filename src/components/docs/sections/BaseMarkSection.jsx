import { Fingerprint } from 'lucide-react';
import PipelineFlowChart from '@/components/docs/basemark/PipelineFlowChart';
import FormatSupportChart from '@/components/docs/basemark/FormatSupportChart';
import RobustnessChart from '@/components/docs/basemark/RobustnessChart';
import TerminologyGlossary from '@/components/docs/basemark/TerminologyGlossary';

export default function BaseMarkSection() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Fingerprint className="w-6 h-6 text-[#FF9A4D]" />
          <h1 className="font-display text-2xl">BASE Mark — Acoustic Watermarking</h1>
        </div>
        <p className="text-muted-foreground">
          BASE Mark is BASE Station's own open, in-house acoustic watermark — a blind, localized
          spread-spectrum system inspired by research such as Meta's AudioSeal and WavMark. Unlike ID3
          tags or C2PA manifests, the mark lives inside the audio waveform itself, so it survives
          metadata stripping, re-encoding, cutting, stem-splitting, sampling and remixing.
        </p>
      </div>

      <div className="rounded-xl border border-[#FF9A4D]/20 bg-[#FF9A4D]/5 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Status: V1 — live and active development.</strong> BASE Mark is a first-generation
        technology that we are continuously testing, developing and growing. Robustness figures below are estimates
        from internal testing and will improve as the engine evolves.
      </div>

      <div className="rounded-xl border border-[#FF9A4D]/20 bg-[#FF9A4D]/5 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Next version: V2 — Neural Watermarking (in development).</strong>{' '}
        We are building a learned, neural-network watermark — the same class of technology as Meta's AudioSeal —
        trained to survive aggressive lossy compression, pitch-shifting and time-stretching. Our GPU inference
        infrastructure is already connected and readiness-tested; V2 ships when the model clears our internal
        robustness benchmarks. V1 marks remain fully traceable after the upgrade.
      </div>

      <img
        src="https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/e8eee4828_generated_image.png"
        alt="Audio waveform with an inaudible embedded watermark layer"
        className="w-full rounded-xl border border-border"
        loading="lazy"
      />

      <section className="space-y-3">
        <h2 className="font-display text-lg">Automatic, canonical watermarking</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Watermarking is fully automatic: the moment an audio asset is saved to the library, the
          BASE Mark automation embeds the payload and the <strong className="text-foreground">marked file
          becomes the canonical file</strong> — the one used for downloads, distribution, ID3 tagging,
          and on-chain registration. The unmarked original is preserved in the asset's provenance record.
          The payload is then threaded through every other provenance layer: ID3 <code className="text-[#FFC98A]">TXXX</code> frames,
          the COS Manifest, the DDEX export, and the content hash anchored on-chain.
        </p>
        <PipelineFlowChart />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">How it works</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Payload:</strong> a 32-bit identifier derived from the track's asset ID (FNV-1a hash), registered in the track's provenance metadata, COS Manifest, DDEX bundle, and ID3 frames.</li>
          <li><strong className="text-foreground">Embedding:</strong> the audio is divided into repeating ~0.77s blocks of 33 segments (1 pilot + 32 payload bits). Each segment carries one bit via a pseudo-random ±1 chip sequence added at roughly −24 dB below the local RMS, so it is inaudible and scales with the music's own loudness (psychoacoustic masking).</li>
          <li><strong className="text-foreground">Localization:</strong> the full payload repeats every block. Any surviving contiguous chunk of about 2 seconds — a sampled loop, a cut stem, a remix layer — still carries the complete identifier.</li>
          <li><strong className="text-foreground">Detection (blind):</strong> no original file is needed. Block alignment is recovered by scanning every sample offset for the pilot signal (survives arbitrary cuts), then each payload bit is majority-voted across all blocks.</li>
          <li><strong className="text-foreground">Tracing:</strong> a detected payload is matched against the BASE Station asset registry to identify the original track, artist and Creative Ownership Score.</li>
        </ul>
      </section>

      <FormatSupportChart />
      <RobustnessChart />

      <section className="space-y-3">
        <h2 className="font-display text-lg">API Endpoints</h2>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p><code className="text-[#FFC98A]">POST applyBaseMark</code> — <span className="text-muted-foreground">body: <code>{'{ assetId }'}</code> or <code>{'{ fileUrl }'}</code>. Embeds the mark into a 16/24-bit PCM WAV or FLAC master, uploads the marked file, promotes it to the asset's canonical audio, and records the payload in the provenance metadata. Returns <code>{'{ payload_hex, marked_file_url }'}</code>.</span></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p><code className="text-[#FFC98A]">POST detectBaseMark</code> — <span className="text-muted-foreground">body: <code>{'{ fileUrl }'}</code>. Scans audio for a BASE Mark. Returns <code>{'{ detected, payload_hex, pilot_score, mean_strength, agreement, matches[] }'}</code> where <code>matches</code> lists registry tracks whose payload matches.</span></p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Where it fits in the provenance stack</h2>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2">
          <p><strong className="text-foreground">Layer 1 — Metadata:</strong> ID3v2 provenance frames + DDEX AI disclosure, now including the BASE Mark payload (easily stripped, but standards-compliant).</p>
          <p><strong className="text-foreground">Layer 2 — Cryptographic:</strong> COS manifest (carries the payload) + on-chain anchor hashing the actual marked audio bytes (tamper-proof and verifiable against the file).</p>
          <p><strong className="text-foreground">Layer 3 — BASE Mark:</strong> in-waveform watermark (survives when layers 1–2 are removed; connects any derivative audio back to layers 1–2 via the shared payload).</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Limitations (v1)</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Embedding accepts 16-bit or 24-bit PCM WAV files and FLAC (decoded to 16-bit PCM WAV before marking).</li>
          <li>Scanning also accepts MP3, OGG, and M4A/MP4 (AAC) — decoded to PCM in your browser before detection. Heavy compression (low bitrates, repeated re-encodes) weakens the mark and lowers detection confidence.</li>
          <li>Heavy lossy re-compression, pitch-shifting or time-stretching can weaken or break detection.</li>
          <li>Audio shorter than ~2 seconds cannot carry a full payload.</li>
          <li>Like all watermarks, it is a deterrent and forensic tool — not unbreakable DRM.</li>
        </ul>
      </section>

      <TerminologyGlossary />
    </div>
  );
}