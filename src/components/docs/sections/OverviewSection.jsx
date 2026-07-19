import { Shield, Fingerprint, Scale } from 'lucide-react';
import CodeBlock from '../CodeBlock';
import SecurityTrustCallout from '../SecurityTrustCallout';

const PILLARS = [
  {
    icon: Fingerprint,
    title: 'Creative Ownership Score (COS)',
    text: 'A 0–100 score quantifying human creative input in AI-assisted works — built from telemetry signals like original lyrics, reference uploads, iteration depth, and persona design.',
  },
  {
    icon: Shield,
    title: 'Provenance Manifests',
    text: 'Cryptographically anchored manifests that travel with every asset — hashed metadata, DDEX AI attribution flags, and ID3v2 frames embedded directly into audio files.',
  },
  {
    icon: Scale,
    title: 'Compliance Mission',
    text: 'Aligned with the RIAA/IFPI GenAI track-level labeling standard (July 2026) and DDEX AI attribution profiles, so creators can prove authorship to DSPs, distributors, and rights bodies.',
  },
];

export default function OverviewSection() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9A4D] mb-2">Getting Started</p>
        <h1 className="text-3xl font-display text-foreground mb-4">The BASE Station Open Standard</h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          BASE Station is an AI music creation platform with provenance built into its core. Every asset generated
          on the platform carries a verifiable record of <em className="text-foreground not-italic font-medium">how much human creativity went into it</em> —
          the Creative Ownership Score — plus DDEX-style AI attribution metadata and embedded ID3v2 provenance frames.
          This hub documents the open interfaces that expose that data to distributors, DSPs, auditors, and partner tools.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="w-6 h-6 text-[#FF9A4D] mb-3" />
              <h3 className="font-semibold text-sm text-foreground mb-2">{p.title}</h3>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed">{p.text}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-display text-foreground">How the pieces fit together</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          When a creator generates or edits a track, COS telemetry signals are accumulated. At export or publish time,
          three provenance layers are produced:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li><span className="text-foreground font-medium">COS calculation</span> — the score, disclosure label (<code className="text-[#FFC98A] text-xs">ai_generated</code> / <code className="text-[#FFC98A] text-xs">ai_assisted</code>), and signal breakdown.</li>
          <li><span className="text-foreground font-medium">DDEX AI attribution bundle</span> — granular boolean flags (lyrics, composition, instrumentation, vocals, post-production) exportable to partner channels.</li>
          <li><span className="text-foreground font-medium">ID3v2 embedding</span> — TXXX and WXXX frames written into the MP3 container so provenance travels with the file itself.</li>
        </ol>
      </div>

      <SecurityTrustCallout />

      <div className="space-y-3">
        <h2 className="text-xl font-display text-foreground">Base URL & authentication</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          All API endpoints are served under the platform base URL and authenticated with a bearer token issued to your
          BASE Station account. Pass it in the <code className="text-[#FFC98A] text-xs">Authorization</code> header on every request.
        </p>
        <CodeBlock
          title="Base URL"
          language="text"
          code={`https://basestation.live/api/v1

Authorization: Bearer <YOUR_API_TOKEN>
Content-Type: application/json`}
        />
      </div>
    </div>
  );
}