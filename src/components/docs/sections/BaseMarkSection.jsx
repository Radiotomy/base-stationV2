import { Fingerprint } from 'lucide-react';

export default function BaseMarkSection() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Fingerprint className="w-6 h-6 text-[#FF9A4D]" />
          <h1 className="font-display text-2xl">BASE Mark — Acoustic Watermarking</h1>
        </div>
        <p className="text-muted-foreground">
          BASE Mark is BASE Station's own open, in-house acoustic watermark — inspired by localized
          watermarking research such as Meta's AudioSeal and WavMark, implemented as a pure-DSP
          spread-spectrum system. Unlike ID3 tags or C2PA manifests, the mark lives inside the audio
          waveform itself, so it survives metadata stripping, re-encoding, cutting, stem-splitting,
          sampling and remixing.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg">How it works</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Payload:</strong> a 32-bit identifier derived from the track's asset ID (FNV-1a hash), registered in the track's provenance metadata.</li>
          <li><strong className="text-foreground">Embedding:</strong> the audio is divided into repeating ~0.77s blocks of 33 segments (1 pilot + 32 payload bits). Each segment carries one bit via a pseudo-random ±1 chip sequence added at roughly −24 dB below the local RMS, so it is inaudible and scales with the music's own loudness.</li>
          <li><strong className="text-foreground">Localization:</strong> the full payload repeats every block. Any surviving contiguous chunk of about 2 seconds — a sampled loop, a cut stem, a remix layer — still carries the complete identifier.</li>
          <li><strong className="text-foreground">Detection:</strong> block alignment is recovered by scanning every sample offset for the pilot signal (survives arbitrary cuts), then each payload bit is majority-voted across all blocks.</li>
          <li><strong className="text-foreground">Tracing:</strong> a detected payload is matched against the BASE Station asset registry to identify the original track, artist and Creative Ownership Score.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">API Endpoints</h2>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p><code className="text-[#FFC98A]">POST applyBaseMark</code> — <span className="text-muted-foreground">body: <code>{'{ assetId }'}</code> or <code>{'{ fileUrl }'}</code>. Embeds the mark into a 16-bit or 24-bit PCM WAV, uploads the marked file, and records the payload in the asset's provenance metadata. Returns <code>{'{ payload_hex, marked_file_url }'}</code>.</span></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p><code className="text-[#FFC98A]">POST detectBaseMark</code> — <span className="text-muted-foreground">body: <code>{'{ fileUrl }'}</code>. Scans a WAV for a BASE Mark. Returns <code>{'{ detected, payload_hex, pilot_score, mean_strength, agreement, matches[] }'}</code> where <code>matches</code> lists registry tracks whose payload matches.</span></p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Where it fits in the provenance stack</h2>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2">
          <p><strong className="text-foreground">Layer 1 — Metadata:</strong> ID3v2 provenance frames + DDEX AI disclosure (easily stripped, but standards-compliant).</p>
          <p><strong className="text-foreground">Layer 2 — Cryptographic:</strong> COS manifest hash + on-chain registration (tamper-proof, but detached from the audio).</p>
          <p><strong className="text-foreground">Layer 3 — BASE Mark:</strong> in-waveform watermark (survives when layers 1–2 are removed; connects any derivative audio back to layers 1–2).</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Limitations (v1)</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Embedding requires 16-bit or 24-bit PCM WAV files (use the WAV download for your track).</li>
          <li>Scanning also accepts MP3, OGG, and M4A/MP4 (AAC) — the studio decodes them to PCM in your browser before detection. Heavy compression (low bitrates, repeated re-encodes) weakens the mark and lowers detection confidence.</li>
          <li>Heavy lossy re-compression, pitch-shifting or time-stretching can weaken or break detection.</li>
          <li>Audio shorter than ~2 seconds cannot carry a full payload.</li>
          <li>Like all watermarks, it is a deterrent and forensic tool — not unbreakable DRM.</li>
        </ul>
      </section>
    </div>
  );
}