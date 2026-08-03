import { Link } from 'react-router-dom';
import { ShieldCheck, Fingerprint, Sparkles, Link2, ScanLine, FileText, Scale, Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TrustPillarCard from '@/components/trust/TrustPillarCard';

// The four things BASE Station does to every track, and the ONE page that owns
// the detail for each. Everything else in the app links here rather than
// re-explaining provenance in its own words.
const PILLARS = [
  {
    icon: ShieldCheck,
    accent: '#fbbf24',
    label: 'Disclosure',
    title: 'GenAI Label',
    body: 'Every sound recording is labeled AI-Generated, AI-Assisted or Human, in line with the music community\'s voluntary track-level labeling program (July 2026).',
    to: '/transparency',
    linkLabel: 'Transparency policy',
  },
  {
    icon: Sparkles,
    accent: '#34d399',
    label: 'Attribution',
    title: 'Creative Ownership Score',
    body: 'A 0–100 measure of the human creative input behind a work, graded across five creative dimensions and exportable as a DDEX attribution profile.',
    to: '/creative-ownership',
    linkLabel: 'How scoring works',
  },
  {
    icon: Fingerprint,
    accent: '#FFC98A',
    label: 'Forensics',
    title: 'BASE Mark',
    body: 'An inaudible watermark woven into the waveform itself. Measured to survive stripped metadata, re-encoding, compression, cutting and stem-splitting — and to trace any derivative back to its origin. Re-timed copies are handled by a newer layer still in testing; the measured limits are published in full.',
    to: '/verify',
    linkLabel: 'Verify a track',
  },
  {
    icon: Link2,
    accent: '#60a5fa',
    label: 'Proof',
    title: 'On-Chain Registration',
    body: 'A content hash of the marked audio is written to the registry with an immutable timestamp — proof of creation that outlives any single platform.',
    to: '/creator-dashboard?tab=proof',
    linkLabel: 'Your registry records',
  },
];

const REFERENCES = [
  { icon: FileText, label: 'Terms of Use', desc: 'Rights, licensing and acceptable use', to: '/terms' },
  { icon: Scale, label: 'Community Tuning Panel', desc: 'Propose and vote on scoring weights', to: '/governance' },
  { icon: Braces, label: 'Developer Hub', desc: 'APIs, schemas and export formats', to: '/docs' },
];

export default function TrustCenter() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto space-y-12">

        {/* Header */}
        <header className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-[#FFC98A]">
            <ScanLine className="w-3.5 h-3.5" /> Built In. Not Bolted On.
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-foreground">Trust &amp; Provenance</h1>
          <p className="text-muted-foreground leading-relaxed">
            BASE Station watermarks, scores, labels and registers every track the moment it is saved —
            automatically, with nothing to opt into. This is the single place to understand what that
            means and where each record lives.
          </p>
        </header>

        {/* The four pillars */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PILLARS.map((p) => <TrustPillarCard key={p.title} {...p} />)}
        </section>

        {/* Human-first stance — stated once, for the whole platform */}
        <section className="merc-card rounded-2xl p-6 md:p-8 space-y-3 text-center max-w-3xl mx-auto">
          <h2 className="font-display text-2xl text-foreground">AI is the instrument. You are the artist.</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We build some of the strongest AI music tools available, and left on autopilot they could run
            as a fully automated hit factory. That is not what this platform is for. Work that leans on the
            tools with little human direction is scored and labeled exactly as such; work shaped by your
            words, your references and your refinements earns the score and the label that reflect it.
            Human participation is not just encouraged here — it is measured, credited and rewarded.
          </p>
        </section>

        {/* Where the records live */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl text-foreground text-center">Where your records live</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl border border-border bg-card p-5 space-y-1.5">
              <p className="font-bold text-foreground">Ownership dashboard</p>
              <p className="text-muted-foreground text-[13px] leading-relaxed">
                Your score history, tier breakdown and every asset&apos;s Provenance Manifest.
              </p>
              <Link to="/creator-dashboard?tab=ownership" className="text-xs font-bold text-[#FFC98A] hover:text-foreground">Open dashboard →</Link>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-1.5">
              <p className="font-bold text-foreground">Proof of ownership</p>
              <p className="text-muted-foreground text-[13px] leading-relaxed">
                On-chain registrations and downloadable certificates for your catalog.
              </p>
              <Link to="/creator-dashboard?tab=proof" className="text-xs font-bold text-[#FFC98A] hover:text-foreground">Open registry →</Link>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-1.5">
              <p className="font-bold text-foreground">Public verification</p>
              <p className="text-muted-foreground text-[13px] leading-relaxed">
                Anyone can scan an audio file for a BASE Mark and see who it belongs to.
              </p>
              <Link to="/verify" className="text-xs font-bold text-[#FFC98A] hover:text-foreground">Scan a file →</Link>
            </div>
          </div>
        </section>

        {/* Reference material */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {REFERENCES.map(({ icon: Icon, label, desc, to }) => (
            <Link
              key={to}
              to={to}
              className="rounded-xl border border-border bg-card p-4 flex items-start gap-3 hover:border-[#FF9A4D]/40 transition-colors"
            >
              <Icon className="w-4 h-4 text-[#FF9A4D] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </section>

        <div className="text-center">
          <Link to="/music-studio">
            <Button className="merc-button rounded-full font-bold px-8">Start Creating</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}