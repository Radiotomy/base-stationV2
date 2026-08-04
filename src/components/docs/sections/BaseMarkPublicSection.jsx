import { Fingerprint, ShieldCheck, Search, Layers, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

const PROPERTIES = [
  {
    icon: Layers,
    title: 'Inside the audio, not the file',
    body:
      'The signature lives in the waveform itself, so it survives metadata stripping, compression, cutting, stem-splitting and remixing — the things that erase ID3 tags and sidecar manifests.',
  },
  {
    icon: Search,
    title: 'Blind detection',
    body:
      'No original file is needed to check a track. Verification runs as a secure service that returns an outcome and, when found, the registry record it points to.',
  },
  {
    icon: ShieldCheck,
    title: 'Abstains instead of guessing',
    body:
      'When there is not enough audio or not enough evidence, BASE Mark reports "no result" rather than a low-confidence answer. A wrong attribution is worse than no attribution.',
  },
];

export default function BaseMarkPublicSection() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Fingerprint className="w-6 h-6 text-[#FF9A4D]" />
          <h1 className="font-display text-2xl">BASE Mark — Audio Watermarking</h1>
        </div>
        <p className="text-muted-foreground">
          BASE Mark is BASE Station's audio watermarking standard. Every audio master saved on the platform is
          stamped with an inaudible forensic signature tied to its registry record, so a track — or an excerpt,
          stem or remix of it — can be traced back to the creator who made it. The signature is layered:
          several complementary technologies are carried on the same file so that an edit which defeats one
          leaves another intact.
        </p>
      </div>

      <div className="rounded-xl border border-[#FF9A4D]/30 bg-[#FF9A4D]/10 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Development and testing are consistently ongoing.</strong> BASE Mark
        is live and protecting tracks today, but the system continues to be benchmarked, hardened and refined as
        we work toward its final form. Capabilities described here reflect current behaviour and will keep
        improving.
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {PROPERTIES.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <Icon className="w-5 h-5 text-[#FF9A4D]" />
              <p className="font-semibold text-foreground text-sm">{p.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg">How it fits together</h2>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Marked on save.</strong> When an audio asset is saved, BASE
            Station embeds the mark automatically and the marked file becomes the canonical one used for
            downloads, distribution, tagging and on-chain registration. The unmarked original is kept in the
            asset's provenance record.
          </p>
          <p>
            <strong className="text-foreground">Threaded through provenance.</strong> The same identifier is
            carried in the track's ID3 frames, its COS Manifest, its DDEX export and the content hash anchored
            on-chain — so even when those outer layers are stripped, the in-audio mark leads back to them.
          </p>
          <p>
            <strong className="text-foreground">Verified on demand.</strong> Anyone can check a file with the
            public <Link to="/verify" className="text-[#FFC98A] underline underline-offset-2">verifier</Link>,
            and creators can scan their own catalogue from{' '}
            <Link to="/base-mark" className="text-[#FFC98A] underline underline-offset-2">BASE Mark Studio</Link>.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Using it</h2>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p>
            <code className="text-[#FFC98A]">POST applyBaseMark</code> —{' '}
            <span className="text-muted-foreground">
              body: <code>{'{ assetId }'}</code> or <code>{'{ fileUrl }'}</code>. Marks a lossless master,
              promotes it to the asset's canonical audio, and records the identifier in provenance metadata.
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p>
            <code className="text-[#FFC98A]">POST detectBaseMark</code> —{' '}
            <span className="text-muted-foreground">
              body: <code>{'{ fileUrl }'}</code>. Scans audio and returns whether a mark was found plus any
              matching registry tracks. Detector internals are never exposed.
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p>
            <code className="text-[#FFC98A]">POST verifyBaseMark</code> —{' '}
            <span className="text-muted-foreground">
              Powers the public verifier at{' '}
              <Link to="/verify" className="text-[#FFC98A] underline underline-offset-2">/verify</Link>. No
              account required; the snippet is processed in memory and never stored.
            </span>
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">What to expect</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Marking accepts lossless masters (16/24-bit PCM WAV and FLAC). Scanning also accepts MP3, OGG and M4A/MP4.</li>
          <li>Short excerpts still resolve, but very short ones are declined rather than guessed — the detector needs enough audio to answer safely.</li>
          <li>Heavy compression and repeated re-encoding reduce confidence, which is why multiple layers are carried rather than one.</li>
          <li>Audio whose speed or pitch has been altered is the hardest case for any watermark. BASE Station operates additional recovery and identification stages for it; coverage there is improving but is not yet complete.</li>
          <li>Like all watermarking, BASE Mark is a deterrent and forensic tool — not unbreakable DRM.</li>
        </ul>
      </section>

      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <BookOpen className="w-4 h-4 text-[#FF9A4D] mt-0.5 shrink-0" />
          <span>
            The engines, parameters, thresholds and detection logic behind each layer are confidential and run
            only inside BASE Station's secure server environment. Published documentation describes measured
            behaviour, never internals.
          </span>
        </p>
      </div>
    </div>
  );
}