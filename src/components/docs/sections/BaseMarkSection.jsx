import { Fingerprint } from 'lucide-react';
import { Link } from 'react-router-dom';
import PipelineFlowChart from '@/components/docs/basemark/PipelineFlowChart';
import FormatSupportChart from '@/components/docs/basemark/FormatSupportChart';
import RobustnessChart from '@/components/docs/basemark/RobustnessChart';
import TerminologyGlossary from '@/components/docs/basemark/TerminologyGlossary';
import LayerCascadeGrid from '@/components/docs/basemark/LayerCascadeGrid';
import SpeedLayerResults from '@/components/docs/basemark/SpeedLayerResults';

export default function BaseMarkSection() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Fingerprint className="w-6 h-6 text-[#FF9A4D]" />
          <h1 className="font-display text-2xl">BASE Mark — Unified Watermarking Standard</h1>
        </div>
        <p className="text-muted-foreground">
          BASE Mark is BASE Station's audio watermarking standard: a single forensic signature made up of
          several complementary layers carried on the same file, each built on a different underlying
          technology so that they fail in different ways. Unlike ID3 tags or C2PA manifests, the signature
          lives inside the audio waveform itself, so it survives metadata stripping, compression, cutting,
          stem-splitting and remixing. Alongside the embedded layers, the protocol also derives a separate
          identification signature that carries no payload but can recognize a copy whose speed or pitch has
          been altered — historically the hardest case for any watermark — and hand that finding to the
          detector. The specific engines, parameters and detection logic behind each layer are confidential
          and run only inside BASE Station's secure server environment; what is published here is the
          measured behaviour of the system, not its internals. Every figure below comes from our own attack
          benchmarks, and testing is ongoing.
        </p>
      </div>

      <div className="rounded-xl border border-[#FF9A4D]/30 bg-[#FF9A4D]/10 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">BASE Mark is under continuous development.</strong> The protocol is
        live and protecting tracks today, but it is not finished — development and adversarial testing are
        consistently ongoing as we work toward the final form of the mark system. Layers are benchmarked against
        real attacks, negative results are published alongside positive ones, and acceptance rules are tightened
        or loosened only when measurement forces it. Figures on this page reflect the current measured state and
        will change as the work continues.
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Status: V1 + V2 are live and automatic on every saved track.</strong> The
        moment an audio asset is saved, BASE Station embeds the spectral layer (instant, no GPU needed) and then the
        neural layer on top, running on our own private GPU deployment. We verified end-to-end that the layers don't
        interfere — each still resolves independently to the same registry record after the other is embedded on top.
        The 32-bit registry payload is identical across both, so either one traces derivative audio back to the same
        track record.
      </div>

      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Status: V3 (Drift Layer) is DECOMMISSIONED.</strong> Removed from the
        funnel in August 2026 after it failed the re-timing gap it was built to close (0% recovery under every pitch
        shift and time stretch measured). The pre-flight audit found <strong className="text-foreground">0 allocated
        slots and 0 assets carrying V3 metadata in any state</strong>, so no identity was ever recoverable through it
        and its removal could not cost a lookup. Shared modules, backend functions, the slot entity, both Replicate
        deployments and the version secrets are all gone; the container source is retained so the layer can be rebuilt
        if re-timing leakage is ever observed in the wild. Production is now a clean two-layer funnel.
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Status: V4 (Speed Layer) is in active benchmarking, admin-only.</strong> It
        is not on the automatic path and is not offered to creators yet. Results so far are strong — it is the only
        layer to recover a re-timed payload, and it held through real MP3, AAC and Opus round trips — but they come
        from a single master and a single payload, so they are early figures rather than a robustness rate. The
        remaining work is a production acceptance threshold, not more container work: codec damage narrows the gap
        between a genuine recovery and a spurious one, so the registry lookup has to gate on measured bit-error
        before this layer can back a real attribution. Benchmark runs are admin-authenticated and the watermark key
        is held as a server-side secret, never shipped in a container layer or a client bundle.
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Status: Print Layer + seeded recovery are in measurement, admin-only.</strong> The
        Print Layer fingerprints a track's spectral geometry using ratios rather than absolute values, so the print
        survives pitch-shifting and tempo-stretching — the attacks that defeat the embedded layers. Its job is not to
        prove anything on its own: it proposes a playback-ratio estimate, the spectral detector inverts it and attempts
        a real payload recovery across several independent 12-second windows, and acceptance requires both payload
        consensus across windows and a combined strength gate. Measured so far: exact-payload recovery on every
        re-timing cell tested across seven masters (resample both directions, ±2 semitone shifts), with zero false
        positives in null runs. Two calibrations remain open — the ratio estimate's error varies by two orders of
        magnitude and the search budget is not yet scaled to the estimate's self-reported quality — so this pipeline
        backs no creator-facing attribution yet.
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
          <li><strong className="text-foreground">Embedding:</strong> a proprietary spread-spectrum process shapes an inaudible signature directly into the waveform, scaled to the music's own loudness (psychoacoustic masking) so it never colors the mix. The exact embedding parameters are confidential and executed exclusively in BASE Station's secure server environment.</li>
          <li><strong className="text-foreground">Localization:</strong> the identifier repeats continuously through the file, so a surviving contiguous chunk — a sampled loop, a cut stem, a remix layer — can still carry the complete identifier. In benchmarking, 5-second excerpts recovered reliably at 100%. Below roughly 3 seconds there isn't enough evidence to attribute safely, so the detector declines to answer instead of guessing.</li>
          <li><strong className="text-foreground">Detection (blind):</strong> no original file is needed. Detection runs as a secure black-box service that reports the outcome without disclosing internal alignment or confidence mechanics.</li>
          <li><strong className="text-foreground">Tracing:</strong> a detected payload is matched against the BASE Station asset registry to identify the original track, artist and Creative Ownership Score.</li>
        </ul>
      </section>

      <FormatSupportChart />
      <RobustnessChart />
      <SpeedLayerResults />

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
          <p><code className="text-[#FFC98A]">POST pollBaseMarkV2</code> — <span className="text-muted-foreground">body: <code>{'{ assetId }'}</code>. Safety-net poll for a neural embed (the signed webhook normally finalizes it the moment the prediction settles). Both routes converge on one shared finalize module, so a job can never be completed two different ways.</span></p>
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
          <p><strong className="text-foreground">Layer 3 — BASE Mark:</strong> the in-waveform watermark cascade — V1 spectral then V2 neural (survives when layers 1–2 are removed; connects any derivative audio back to layers 1–2 via the shared 32-bit payload, which is identical across both layers).</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Limitations</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Embedding accepts 16-bit or 24-bit PCM WAV files and FLAC (decoded to 16-bit PCM WAV before marking).</li>
          <li>Scanning also accepts MP3, OGG, and M4A/MP4 (AAC) — decoded to PCM in your browser before detection. Heavy compression (low bitrates, repeated re-encodes) weakens the spectral layer and lowers detection confidence, which is exactly why the neural layer exists alongside it. The Speed Layer is the one layer measured against real encoders end to end, at 128k only so far.</li>
          <li><strong className="text-foreground">Pitch-shifting and time-stretching defeat both production layers on a normal scan.</strong> Resampling a track — even by one semitone or 5% — broke the spectral <em>and</em> the neural layer in our benchmark (0% recovery on both). The retired Drift Layer was built to close this gap and, when measured, did not: it returned 0% under the same attacks, which is why it is gone. The Speed Layer (V4) does recover resample-based changes, by estimating the playback ratio from the signal rather than being told it — but V4 is still in benchmarking and is not on the automatic path, so for any track marked today this remains BASE Mark's most significant limitation in production.</li>
          <li><strong className="text-foreground">Pitch-preserved tempo stretching is unrecovered by every watermark layer, including V4.</strong> Overlap-add resynthesis discards the fine phase structure every embedded layer relies on, so the payload cannot be recovered at detection time. This is a design limit, not a tuning problem. The Print Layer is the honest answer: its ratio-based fingerprint survives tempo stretching, so a stretched copy can still be <em>identified</em> and its warp factor estimated — it just cannot yield the embedded payload back.</li>
          <li><strong className="text-foreground">Print-seeded recovery is measurement, not production.</strong> The Print Layer's ratio estimate has been measured from 7 to over 1,200 parts-per-million off the true ratio, while the spectral recovery peak is only ~20 ppm wide — so recovery needs a correction search around the estimate, and the right search budget depends on the estimate's self-reported fit quality, which is not yet calibrated. Until it is, no Print-seeded result backs an attribution.</li>
          <li><strong className="text-foreground">V4 acceptance is a threshold, not a clean pass/fail.</strong> Measured against real 128k MP3, AAC and Opus round trips the payload came back exactly every time, but bit-error on genuine recoveries reached ~0.34 where spurious results have stayed at 0.72 or worse. Attribution therefore depends on a published acceptance threshold sitting between those bands, and until that gate is enforced in the registry lookup, V4 results are treated as benchmark data rather than evidence.</li>
          <li><strong className="text-foreground">The Drift Layer was removed rather than kept as dead weight.</strong> Measured standalone on clean audio it recovered the slot in 0% of trials under every pitch shift tested (±1 and +2 semitones, +37 cents, and 44.1/48kHz mishandling), 0% under ±5% time stretch, and 0% at 10dB SNR — the exact gap it was built to close. Its only advantage was short-excerpt coverage, which never reached production. Because the audit found zero slots allocated and zero assets marked, decommissioning it removed complexity and per-scan latency without losing a single recoverable identity. We publish the negative result because it is the measured one.</li>
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