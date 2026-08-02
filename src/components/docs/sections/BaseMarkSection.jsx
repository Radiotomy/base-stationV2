import { Fingerprint } from 'lucide-react';
import { Link } from 'react-router-dom';
import PipelineFlowChart from '@/components/docs/basemark/PipelineFlowChart';
import FormatSupportChart from '@/components/docs/basemark/FormatSupportChart';
import RobustnessChart from '@/components/docs/basemark/RobustnessChart';
import TerminologyGlossary from '@/components/docs/basemark/TerminologyGlossary';
import LayerCascadeGrid from '@/components/docs/basemark/LayerCascadeGrid';

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
          up to three complementary layers embedded on the same file — a blind spread-spectrum
          <strong className="text-foreground"> Spectral Layer (V1)</strong>, a learned
          <strong className="text-foreground"> Neural Layer (V2)</strong> built on SilentCipher (Singh et al.,
          Interspeech 2024), and a <strong className="text-foreground">Drift Layer (V3)</strong> built on
          WavMark that targets re-timed audio. Unlike ID3 tags or C2PA manifests, the mark lives inside the
          audio waveform itself, so it survives metadata stripping, band-limiting, quantization, cutting,
          stem-splitting and remixing. Pitch- and tempo-shifted copies are the known gap in V1 and V2 — the
          reason V3 exists — see the measured robustness figures below.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Status: V1 + V2 are live and automatic on every saved track.</strong> The
        moment an audio asset is saved, BASE Station embeds the spectral layer (instant, no GPU needed) and then the
        neural layer on top, running on our own private GPU deployment. We verified end-to-end that the layers don't
        interfere — each still resolves independently to the same registry record after the other is embedded on top.
        The 32-bit registry payload is identical across both, so either one traces derivative audio back to the same
        track record.
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Status: V3 (Drift Layer) is opt-in, not yet automatic.</strong> It is
        triggered per asset by the owner or an admin, and only after V2 has completed — the drift mark rides on top of
        the finished cascade, so marking a pre-V2 file would just be overwritten later. Two things keep it off the
        default path: full-length throughput is still unproven (the encode has been measured on bounded clips, not
        whole masters), and the slot pool has a hard ceiling of 65,536 concurrent assets. Canonical audio is never
        touched until a run finalizes and passes its integrity check.
      </div>

      <LayerCascadeGrid />

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
          <li><strong className="text-foreground">Payload:</strong> a unique 32-bit identifier derived from the track's asset record, registered in the track's provenance metadata, COS Manifest, DDEX bundle, and ID3 frames. V1 and V2 both carry it in full.</li>
          <li><strong className="text-foreground">Slot (V3 only):</strong> WavMark's capacity is 16 sync bits plus 16 usable bits, so the 32-bit payload does not fit. The Drift Layer therefore carries a <em>16-bit slot</em> — a pointer the registry resolves back to the asset. The slot record also stores the asset's V1/V2 payload, so a V3-only recovery still correlates to the other two layers. Slots are allocated before the GPU run, returned to the pool if it fails, and recycled only after a deliberate delay, since a released slot may still be embedded in files already in the wild.</li>
          <li><strong className="text-foreground">Embedding:</strong> a proprietary spread-spectrum process shapes an inaudible signature directly into the waveform, scaled to the music's own loudness (psychoacoustic masking) so it never colors the mix. The exact embedding parameters are confidential and executed exclusively in BASE Station's secure server environment.</li>
          <li><strong className="text-foreground">Localization:</strong> the identifier repeats continuously through the file, so a surviving contiguous chunk — a sampled loop, a cut stem, a remix layer — can still carry the complete identifier. In benchmarking, 5-second excerpts recovered reliably at 100%. Below roughly 3 seconds there isn't enough evidence to attribute safely, so the detector declines to answer instead of guessing.</li>
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
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p><code className="text-[#FFC98A]">POST detectBaseMarkV2</code> — <span className="text-muted-foreground">body: <code>{'{ fileUrl }'}</code>. Runs the neural detector independently of the spectral one. Returns the same 32-bit payload when it resolves.</span></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p><code className="text-[#FFC98A]">POST startBaseMarkV3</code> — <span className="text-muted-foreground">body: <code>{'{ assetId, maxSeconds? }'}</code>. Owner or admin only, and rejected with 409 while V2 is still in flight. Allocates a slot, starts the Drift Layer prediction and returns immediately with <code>{'{ status: "embedding", prediction_id, slot_hex }'}</code>. Rate-limited; the master is untouched until finalization.</span></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p><code className="text-[#FFC98A]">POST pollBaseMarkV3</code> — <span className="text-muted-foreground">body: <code>{'{ assetId }'}</code>. Safety-net poll for a Drift Layer run (a webhook normally finalizes it the moment it settles). On success it downloads the output, runs the integrity check, rehosts the file and activates the slot.</span></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p><code className="text-[#FFC98A]">POST deepScanBaseMark</code> — <span className="text-muted-foreground">body: <code>{'{ fileUrl }'}</code>. Re-times suspect audio across a curated set of inverse ratios and re-runs the detector at each. Recovers exact-ratio shifts only, requires ≥12s, and processes candidates in bounded batches across invocations.</span></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p><code className="text-[#FFC98A]">POST verifyBaseMark</code> — <span className="text-muted-foreground">Public verifier behind <Link to="/verify" className="text-[#FFC98A] underline underline-offset-2">/verify</Link>. No account required; the snippet is processed in memory and never stored.</span></p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Where it fits in the provenance stack</h2>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2">
          <p><strong className="text-foreground">Layer 1 — Metadata:</strong> ID3v2 provenance frames + DDEX AI disclosure, now including the BASE Mark payload (easily stripped, but standards-compliant).</p>
          <p><strong className="text-foreground">Layer 2 — Cryptographic:</strong> COS manifest (carries the payload) + on-chain anchor hashing the actual marked audio bytes (tamper-proof and verifiable against the file).</p>
          <p><strong className="text-foreground">Layer 3 — BASE Mark:</strong> the in-waveform watermark cascade — V1 spectral, V2 neural, and optionally V3 drift (survives when layers 1–2 are removed; connects any derivative audio back to layers 1–2 via the shared payload, or via the slot registry in V3's case).</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Limitations</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Embedding accepts 16-bit or 24-bit PCM WAV files and FLAC (decoded to 16-bit PCM WAV before marking).</li>
          <li>Scanning also accepts MP3, OGG, and M4A/MP4 (AAC) — decoded to PCM in your browser before detection. Heavy compression (low bitrates, repeated re-encodes) weakens the spectral layer and lowers detection confidence, which is exactly why the neural layer exists alongside it.</li>
          <li><strong className="text-foreground">Pitch-shifting and time-stretching defeat V1 and V2 on a normal scan.</strong> Resampling a track — even by one semitone or 5% — broke the spectral <em>and</em> the neural layer in our benchmark (0% recovery on both). The Drift Layer was built to close this gap and, when measured, does not: it returns 0% under the same attacks. All three layers share this blind spot. This is BASE Mark's most significant known limitation, and we do not claim otherwise.</li>
          <li><strong className="text-foreground">The Drift Layer does not close the re-timing gap it was built for.</strong> Measured standalone on clean audio — WavMark's best case, before V1's noise floor is added — it recovered the slot in 0% of trials under every pitch shift tested (±1 and +2 semitones, +37 cents, and 44.1/48kHz mishandling) and 0% under ±5% time stretch. It also returned 0% at 10dB SNR. What it does add is short-excerpt coverage: 100% slot recovery from 2-second crops, where the spectral layer abstains, plus 100% through band-limiting, 8-bit quantization and 20dB-SNR noise. We are publishing the negative result because it is the measured one.</li>
          <li><strong className="text-foreground">V3 points rather than carries, and the pool is finite.</strong> A recovered slot is only useful while it maps to a live asset: 65,536 concurrent slots exist, and recycling a released slot risks misattributing files already in circulation, which is why reuse is delayed rather than immediate.</li>
          <li><strong className="text-foreground">Deep scan recovers some of that, at exact ratios only.</strong> The mark isn't erased by re-timing, only knocked out of alignment, so the <Link to="/verify" className="text-[#FFC98A] underline underline-offset-2">verifier</Link> can re-time the audio to undo it. Measured 100% recovery for whole semitone shifts and for 44.1kHz/48kHz sample-rate mishandling. Tolerance is sub-sample: a candidate even 2 cents off recovers nothing, so arbitrary hand-dialed speed changes stay out of reach, and pitch-preserved tempo stretching is unrecoverable because overlap-add resynthesis isn't invertible. Requires at least 12 seconds of audio.</li>
          <li><strong className="text-foreground">Short excerpts are declined, not guessed.</strong> Detection thresholds scale with how much audio you supply, and below roughly 3 seconds the detector reports insufficient evidence and returns no payload. An earlier build answered at 2 seconds with a confidently incorrect payload; it now abstains, because a wrong attribution is worse than no attribution. Recovery from 5-second excerpts measures 100%.</li>
          <li>Band-limited material (narrow-bandwidth or heavily filtered audio) is the hardest case for imperceptible neural marking, as noted by the SilentCipher authors.</li>
          <li>Like all watermarks, BASE Mark is a deterrent and forensic tool — not unbreakable DRM.</li>
        </ul>
      </section>

      <TerminologyGlossary />
    </div>
  );
}