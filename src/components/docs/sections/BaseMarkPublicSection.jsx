import { Fingerprint, ShieldCheck, Search, Layers, BookOpen, Scale, ArrowRight, Infinity as InfinityIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PublicLayerDiagram from '@/components/docs/basemark/public/PublicLayerDiagram';
import PublicPipelineDiagram from '@/components/docs/basemark/public/PublicPipelineDiagram';
import PublicResilienceChart from '@/components/docs/basemark/public/PublicResilienceChart';

const PROPERTIES = [
  {
    icon: Layers,
    title: 'Inside the audio, not the file',
    body:
      'The signature lives in the waveform itself, so it survives metadata stripping, compression, cutting, stem-splitting and remixing — the things that erase ID3 tags and sidecar manifests in seconds.',
  },
  {
    icon: Search,
    title: 'Blind detection',
    body:
      'No original file is needed to check a track. Verification runs as a secure service that returns an outcome and, when found, the registry record behind it.',
  },
  {
    icon: ShieldCheck,
    title: 'Abstains instead of guessing',
    body:
      'When there is not enough audio or not enough evidence, BASE Mark reports "no result" rather than a low-confidence answer. A wrong attribution is worse than no attribution.',
  },
];

const STATS = [
  { value: '100%', label: 'of masters marked automatically on save' },
  { value: '2', label: 'independent signatures on every track' },
  { value: '$0', label: 'cost to creators — provenance is not an upsell' },
];

export default function BaseMarkPublicSection() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="rounded-2xl border border-[#FF9A4D]/25 bg-gradient-to-br from-[#241C14] to-[#14100C] p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-2">
          <Fingerprint className="w-6 h-6 text-[#FF9A4D]" />
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#FFC98A]">
            The BASE Mark Protocol
          </span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight">
          Every track leaves the platform carrying a record of where it came from.
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-3xl">
          BASE Mark is BASE Station&apos;s audio watermarking standard. Every master saved on the platform is
          stamped with an inaudible forensic signature bound to its registry record — so a track, or an
          excerpt, stem or remix of it, can be traced back to the registered work it came from. The signature is
          layered: complementary technologies ride on the same file so that an edit defeating one leaves
          another intact. It is applied automatically, to everything, from the first save.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="font-display text-2xl text-iridescent">{s.value}</p>
              <p className="text-[11.5px] text-muted-foreground leading-snug mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link to="/verify">
            <Button className="merc-button rounded-full font-bold px-6">
              Verify a track free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/base-mark">
            <Button variant="outline" className="rounded-full font-bold px-6">
              Scan your catalogue
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-[#FF9A4D]/30 bg-[#FF9A4D]/10 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Development and adversarial testing are continuously ongoing.</strong>{' '}
        BASE Mark is live and protecting tracks today, and it keeps being benchmarked, attacked and hardened as
        we work toward its final form. Everything published here reflects measured behaviour — including the
        results that did not go our way — and will keep improving.
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

      {/* Architecture */}
      <section className="space-y-3">
        <h2 className="font-display text-lg">The architecture</h2>
        <PublicLayerDiagram />
      </section>

      {/* Pipeline */}
      <section className="space-y-3">
        <h2 className="font-display text-lg">How it fits together</h2>
        <PublicPipelineDiagram />
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Marked on save.</strong> When an audio asset is saved, BASE
            Station embeds the mark automatically and the marked file becomes the canonical one used for
            downloads, distribution, tagging and on-chain registration. The unmarked original is kept in the
            asset&apos;s provenance record.
          </p>
          <p>
            <strong className="text-foreground">Threaded through provenance.</strong> The same identifier is
            carried in the track&apos;s ID3 frames, its COS Manifest, its DDEX export and the content hash
            anchored on-chain — so even when those outer layers are stripped, the in-audio mark leads back to
            them.
          </p>
          <p>
            <strong className="text-foreground">Verified on demand.</strong> Anyone can check a file with the
            public <Link to="/verify" className="text-[#FFC98A] underline underline-offset-2">verifier</Link>,
            and creators can scan their own catalogue from{' '}
            <Link to="/base-mark" className="text-[#FFC98A] underline underline-offset-2">BASE Mark Studio</Link>.
          </p>
        </div>
      </section>

      {/* Measured results */}
      <section className="space-y-3">
        <h2 className="font-display text-lg">What we have measured</h2>
        <PublicResilienceChart />
      </section>

      {/* Why it matters — investor/user framing */}
      <section className="space-y-3">
        <h2 className="font-display text-lg">Why it matters</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <Scale className="w-5 h-5 text-[#FF9A4D]" />
            <p className="font-semibold text-foreground text-sm">Attribution is becoming law</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Disclosure and attribution obligations are arriving across every major music market. A platform
              that can show which work came from where is not a feature — it is the licence to operate.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <InfinityIcon className="w-5 h-5 text-[#FF9A4D]" />
            <p className="font-semibold text-foreground text-sm">It outlives the file</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tags get stripped, manifests get lost, links rot. A signature carried in the audio itself travels
              with every copy, clip and repost of the work — with no dependency on the container it ships in.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <ShieldCheck className="w-5 h-5 text-[#FF9A4D]" />
            <p className="font-semibold text-foreground text-sm">Evidence, not vibes</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A detection correlates with the on-chain anchor and the provenance manifest, so a claim is backed
              by a timestamped record rather than an assertion. Published figures are measured, not marketed.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Using it</h2>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
          <p>
            <code className="text-[#FFC98A]">POST applyBaseMark</code> —{' '}
            <span className="text-muted-foreground">
              body: <code>{'{ assetId }'}</code> or <code>{'{ fileUrl }'}</code>. Marks a lossless master,
              promotes it to the asset&apos;s canonical audio, and records the identifier in provenance metadata.
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
        <h2 className="font-display text-lg">What to expect — stated plainly</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Marking accepts lossless masters (16/24-bit PCM WAV and FLAC). Scanning also accepts MP3, OGG and M4A/MP4.</li>
          <li>Short excerpts still resolve, but very short ones are declined rather than guessed — the detector needs enough audio to answer safely.</li>
          <li>Heavy compression and repeated re-encoding reduce confidence, which is precisely why multiple layers are carried rather than one.</li>
          <li>Audio whose speed or pitch has been altered is the hardest case for any watermark, industry-wide. BASE Station runs additional recovery and identification stages for it; coverage there is improving but is not yet complete, and we say so rather than implying otherwise.</li>
          <li>Like all watermarking, BASE Mark is a deterrent and a forensic instrument — not unbreakable DRM. Anyone claiming otherwise about any system is selling something.</li>
          <li>A recovered mark identifies the registered recording a piece of audio came from. That is strong, dated evidence for a rights conversation — it is not a determination of authorship or copyright, and no watermark can be.</li>
        </ul>
      </section>

      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <BookOpen className="w-4 h-4 text-[#FF9A4D] mt-0.5 shrink-0" />
          <span>
            The engines, parameters, thresholds and detection logic behind each layer are confidential and run
            only inside BASE Station&apos;s secure server environment. Published documentation describes
            measured behaviour, never internals — a boundary that exists to keep mark-removal tooling from
            being written against our own documentation.
          </span>
        </p>
      </div>

      {/* Closing CTA */}
      <div className="rounded-2xl border border-[#FF9A4D]/25 bg-gradient-to-br from-[#241C14] to-[#14100C] p-6 md:p-8 text-center space-y-4">
        <h2 className="font-display text-2xl text-foreground">Provenance, on by default.</h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Make a track on BASE Station and it is marked, scored, labeled and anchored before you ever click
          download. Nothing to configure, nothing to purchase, nothing to remember.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/music-studio">
            <Button className="merc-button rounded-full font-bold px-8">Start creating</Button>
          </Link>
          <Link to="/trust">
            <Button variant="outline" className="rounded-full font-bold px-8">See the full trust stack</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}