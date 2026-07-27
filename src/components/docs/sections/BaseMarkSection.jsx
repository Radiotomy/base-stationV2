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
          <h1 className="font-display text-2xl">BASE Mark — Unified Watermarking Standard</h1>
        </div>
        <p className="text-muted-foreground">
          BASE Mark is BASE Station's own in-house audio watermark: a single forensic signature built from
          two complementary layers embedded on the same file — a blind, localized spread-spectrum layer and
          a learned neural-network layer, in the same class as research like Meta's AudioSeal and WavMark.
          Unlike ID3 tags or C2PA manifests, the mark lives inside the audio waveform itself, so it survives
          metadata stripping, re-encoding, cutting, stem-splitting, sampling and remixing.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Status: live, applied automatically to every saved track.</strong> The
        moment an audio asset is saved, BASE Station embeds <strong className="text-foreground">both layers</strong>
        on the same file: the spectral layer first (instant, no GPU needed), then the neural layer on top, running on
        our own private GPU deployment. We verified end-to-end that the two layers don't interfere with one another —
        each still resolves independently to the same registry record after the other is embedded on top. The 32-bit
        registry payload is identical across both layers, so either one traces any derivative audio back to the same
        track record.
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm">
        <p className="font-semibold text-foreground">Why two layers instead of one?</p>
        <p className="text-muted-foreground">The two layers are complementary technologies with different strengths, so
          combining them into one signature gives forensic redundancy: an attack that defeats one layer usually leaves
          the other intact.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <p className="font-medium text-foreground">Spectral Layer</p>
            <p className="text-muted-foreground text-xs"><strong className="text-emerald-400">Strengths:</strong> instant, deterministic, no GPU dependency — embeds synchronously in the same request that saves the track; cheap to verify at scale.</p>
            <p className="text-muted-foreground text-xs"><strong className="text-[#FFC98A]">Weaknesses:</strong> weakens under aggressive lossy re-encoding, pitch-shifting or time-stretching.</p>
          </div>
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <p className="font-medium text-foreground">Neural Layer</p>
            <p className="text-muted-foreground text-xs"><strong className="text-emerald-400">Strengths:</strong> survives the compression, pitch and time attacks that weaken the spectral layer — it's learned to be robust to exactly those transforms.</p>
            <p className="text-muted-foreground text-xs"><strong className="text-[#FFC98A]">Weaknesses:</strong> runs async on a GPU (cold starts can take a couple of minutes) and detection costs more compute per scan.</p>
          </div>
        </div>
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
          <li><strong className="text-foreground">Payload:</strong> a unique 32-bit identifier derived from the track's asset record, registered in the track's provenance metadata, COS Manifest, DDEX bundle, and ID3 frames.</li>
          <li><strong className="text-foreground">Embedding:</strong> a proprietary spread-spectrum process shapes an inaudible signature directly into the waveform, scaled to the music's own loudness (psychoacoustic masking) so it never colors the mix. The exact embedding parameters are confidential and executed exclusively in BASE Station's secure server environment.</li>
          <li><strong className="text-foreground">Localization:</strong> the identifier repeats continuously through the file. Any surviving contiguous chunk of a few seconds — a sampled loop, a cut stem, a remix layer — still carries the complete identifier.</li>
          <li><strong className="text-foreground">Detection (blind):</strong> no original file is needed. Detection runs as a secure black-box service that reports the outcome without disclosing internal alignment or confidence mechanics.</li>
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
          <p><code className="text-[#FFC98A]">POST detectBaseMark</code> — <span className="text-muted-foreground">body: <code>{'{ fileUrl }'}</code>. Scans audio for a BASE Mark (creators, authenticated). Returns <code>{'{ detected, payload_hex, mean_strength, agreement, matches[] }'}</code> where <code>matches</code> lists registry tracks whose payload matches. Internal detector diagnostics are never exposed.</span></p>
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
        <h2 className="font-display text-lg">Limitations</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Embedding accepts 16-bit or 24-bit PCM WAV files and FLAC (decoded to 16-bit PCM WAV before marking).</li>
          <li>Scanning also accepts MP3, OGG, and M4A/MP4 (AAC) — decoded to PCM in your browser before detection. Heavy compression (low bitrates, repeated re-encodes) weakens the spectral layer and lowers detection confidence, which is exactly why the neural layer exists alongside it.</li>
          <li>Heavy lossy re-compression, pitch-shifting or time-stretching can weaken or break the spectral layer specifically; the neural layer is built to survive these.</li>
          <li>Audio shorter than ~2 seconds cannot carry a full payload.</li>
          <li>Like all watermarks, BASE Mark is a deterrent and forensic tool — not unbreakable DRM.</li>
        </ul>
      </section>

      <TerminologyGlossary />
    </div>
  );
}