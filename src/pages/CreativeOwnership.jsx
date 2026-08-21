import { Link } from 'react-router-dom';
import { ArrowLeft, Fingerprint, TrendingUp, Award, Sparkles, FileText, Mic2, Image, Upload, RefreshCw, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SCORE_TIERS, OWNERSHIP_POLICY_TEXT } from '@/utils/participationScore';
import AiDisclosureBadge from '@/components/music/AiDisclosureBadge';
import ParticipationBadge from '@/components/music/ParticipationBadge';

const SIGNALS = [
  { icon: FileText,  pts: '+35', label: 'Bring your own content',   desc: 'Write your own lyrics, script, or copy — the single biggest signal of authorship.' },
  { icon: Sparkles,  pts: '+7–18', label: 'Write with intention',    desc: 'Prompt depth is graded on a curve — basic (+7), detailed 100+ chars (+14), deep 200+ chars (+18). Real musical direction (BPM, key, structure) adds +6 more.' },
  { icon: Upload,    pts: '+12', label: 'Upload reference material', desc: 'Source audio, images, or documents ground the AI in your creative choices.' },
  { icon: Mic2,      pts: '+9',  label: 'Use a saved persona',       desc: 'Voice personas, templates, and presets carry your artistic identity forward.' },
  { icon: Image,     pts: '+6–10', label: 'Choose your style',       desc: 'Custom genres, moods, and style tags (+6); a rich multi-tag palette earns +4 more.' },
  { icon: RefreshCw, pts: '+8–20', label: 'Iterate and refine',      desc: 'Remixing, extending, and reworking prior pieces (+8) — and a recorded human performance adds +12.' },
];

const DIMENSIONS = [
  { label: 'Content Authorship',  desc: 'Did the words, script, or source material come from you?' },
  { label: 'Creative Direction',  desc: 'How much deliberate direction — prompt depth, musical specificity — did you give?' },
  { label: 'Sonic Identity',      desc: 'Style choices and reference material that shape the sound.' },
  { label: 'Vocal Identity',      desc: 'Personas and voice design carrying your artistic identity.' },
  { label: 'Craft & Refinement',  desc: 'Iteration, reworking, and human performances layered into the work.' },
];

export default function CreativeOwnership() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-16 inset-x-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-12 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <div className="flex-1" />
        <Fingerprint className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold">Creative Ownership Score</span>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-28 pb-14 px-6 bg-gradient-to-br from-emerald-900/30 to-black">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-5">
            <TrendingUp className="w-3.5 h-3.5" /> The Living Standard — tuned by the community
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Your Creativity, <span className="text-iridescent">Measured & Credited</span>
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            The Creative Ownership Score (COS) is a 0–100 measure of the human creative input behind every
            piece of AI-generated content on BASE Station — aligned with the music community's voluntary
            GenAI labeling program (RIAA, IFPI &amp; partners, July 2026). It measures the creative input
            we can actually observe in our own studios, and the scoring weights are an open ledger the
            community benchmarks and tunes together.
          </p>
          <div className="flex items-center justify-center gap-6 mt-8">
            {[15, 55, 90].map(s => <ParticipationBadge key={s} score={s} size={64} />)}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">

        {/* Why it matters */}
        <section className="text-center space-y-3">
          <h2 className="text-2xl font-black text-foreground">AI is the instrument. You are the artist.</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            Anyone can press a button. What sets creators apart is the direction they give — the lyrics they write,
            the references they bring, the styles they choose, and the refinements they make. The COS captures that
            fingerprint and turns it into a score, a disclosure label, and a creator tier that travel with your work.
          </p>
          <p className="text-xs text-muted-foreground/70 max-w-2xl mx-auto leading-relaxed">
            What the score is not: a measure of quality, a ruling on authorship, and not a claim of
            copyright. It records the creative choices we observed while you worked — which makes it
            disclosure you can stand behind, not a verdict on who owns the result.
          </p>
        </section>

        {/* Two labels */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <AiDisclosureBadge label="ai_assisted" />
            <p className="text-sm font-black text-foreground">Score 40–100 · Substantial human input</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You shaped this work — your content, your direction, your refinements. This is the label to aim for,
              and it's entirely in your hands.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <AiDisclosureBadge label="ai_generated" />
            <p className="text-sm font-black text-foreground">Score 0–39 · Mostly AI-driven</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The AI did the heavy lifting with minimal direction. Nothing wrong with that — but if you rely on
              auto-everything, this is the label most of your content will carry under the program's guidelines.
            </p>
          </div>
        </section>

        {/* How to raise your score */}
        <section>
          <h2 className="text-2xl font-black text-foreground text-center mb-2">How to raise your score</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">Every signal below is a choice you can make in any studio — stack them and watch your tier climb.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SIGNALS.map(s => (
              <div key={s.label} className="p-4 rounded-2xl bg-card border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <s.icon className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-black text-emerald-300">{s.pts}</span>
                </div>
                <p className="text-sm font-bold text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Five dimensions — COS Engine 2.0 */}
        <section>
          <h2 className="text-2xl font-black text-foreground text-center mb-2">Five creative dimensions</h2>
          <p className="text-sm text-muted-foreground text-center mb-6 max-w-2xl mx-auto">
            COS Engine 2.0 doesn't just produce a number — every point maps to one of five named creative
            dimensions, each aligned 1:1 with a DDEX AI attribution category. Your manifest shows exactly
            <em> which aspects</em> of the work were human-directed, plus a telemetry-confidence metric
            reflecting how much recorded evidence backs the score.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {DIMENSIONS.map(d => (
              <div key={d.label} className="p-4 rounded-2xl bg-card border border-border space-y-1.5">
                <p className="text-sm font-bold text-foreground">{d.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tiers */}
        <section>
          <h2 className="text-2xl font-black text-foreground text-center mb-6">The three creator tiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...SCORE_TIERS].map(t => (
              <div key={t.key} className="p-6 rounded-2xl bg-card border border-border text-center space-y-2"
                style={{ borderColor: `${t.color}40` }}>
                <p className="text-3xl">{t.emoji}</p>
                <p className="text-lg font-black" style={{ color: t.color }}>{t.label}</p>
                <p className="text-xs font-mono text-muted-foreground">score {t.min}–{t.max}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Provenance Manifest & DDEX export */}
        <section className="p-6 rounded-2xl bg-card border border-amber-500/20 space-y-4">
          <h2 className="text-2xl font-black text-foreground text-center">🔒 The Provenance Manifest</h2>
          <p className="text-sm text-muted-foreground leading-relaxed text-center max-w-2xl mx-auto">
            Your score doesn't stay locked inside BASE Station. Every scored asset carries a{' '}
            <strong className="text-foreground">DDEX-style AI attribution profile</strong> — granular flags
            for lyrical content, composition, instrumentation, vocals, and post-production — plus an optional
            C2PA provenance hash anchoring the COS metrics to the audio container.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
              <p className="font-bold text-foreground">Granular attribution</p>
              <p className="text-muted-foreground leading-relaxed">Each creative layer is marked 🤖 Synthetic or 👤 Human based on your recorded telemetry — no guesswork.</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
              <p className="font-bold text-foreground">DDEX Tag Bundle export</p>
              <p className="text-muted-foreground leading-relaxed">Copy an XML metadata snippet from any manifest to hand to distributors and downstream partner channels.</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
              <p className="font-bold text-foreground">Something to show on review</p>
              <p className="text-muted-foreground leading-relaxed">When a platform flags AI content for manual review, a detailed manifest gives you dated evidence to submit. Each platform still makes its own call.</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/70 text-center">
            Open any scored item's manifest via the 🔒 button in{' '}
            <Link to="/creator-dashboard?tab=ownership" className="text-amber-400 hover:underline">My Workspace → Ownership</Link>.
          </p>
        </section>

        {/* Policy */}
        <section className="p-6 rounded-2xl bg-muted/40 border border-border space-y-3">
          <p className="text-xs text-muted-foreground italic leading-relaxed text-center">"{OWNERSHIP_POLICY_TEXT}"</p>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed text-center">
            The COS extends the music community&apos;s track-level GenAI labeling program to lyrics, cover art
            and video. It is disclosure and evidence — it does not grant copyright or settle a
            competing claim.{' '}
            <Link to="/transparency" className="text-emerald-400 hover:underline">See the labeling policy →</Link>{' '}
            <Link to="/trust" className="text-emerald-400 hover:underline">What our records can and can&apos;t show →</Link>
          </p>
        </section>

        {/* CTA */}
        <section className="text-center space-y-4">
          <h2 className="text-2xl font-black text-foreground">See where you stand</h2>
          <p className="text-sm text-muted-foreground">Your Ownership dashboard tracks your average score, tier breakdown, and creative evolution over time.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/creator-dashboard?tab=ownership">
              <Button className="rounded-xl font-bold gap-2 merc-button"><Award className="w-4 h-4" /> Open My Ownership Dashboard</Button>
            </Link>
            <Link to="/trust">
              <Button variant="outline" className="rounded-xl font-bold gap-2"><User className="w-4 h-4" /> Trust &amp; Provenance</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}