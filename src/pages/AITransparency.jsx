import { Link } from "react-router-dom";
import { ShieldCheck, Bot, Users, FileText, Flag } from "lucide-react";
import AILabelBadge from "@/components/common/AILabelBadge";

const LABELS = [
  {
    value: "ai_generated",
    title: "AI-Generated",
    desc: "Generative AI created the entirety or the primary portion of the sound recording — for example an AI-generated lead vocal, a key AI-generated instrumental performance, or fully prompt-generated music.",
  },
  {
    value: "ai_assisted",
    title: "AI-Assisted",
    desc: "The recording was created substantially by humans and expresses human creativity, but generative AI was used for some expressive elements. Humans performed the lead vocal and primary instruments.",
  },
  {
    value: "human",
    title: "Human",
    desc: "No generative AI was used in the sound recording.",
  },
];

export default function AITransparency() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold tracking-wider uppercase text-[#FFC98A]">
            <ShieldCheck className="w-3.5 h-3.5" /> Music Community GenAI Labeling Program · July 2026
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-white">AI Transparency</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            BASE Station voluntarily labels every sound recording in alignment with the track-level
            GenAI labeling program introduced by the music community (IFPI, RIAA, A2IM, WIN, IMPALA,
            The Grammys, SAG-AFTRA &amp; the Human Artistry Campaign — July 2026).
          </p>
        </header>

        {/* The three labels */}
        <section className="merc-card rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-2xl text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#FF9A4D]" /> What the badges mean
          </h2>
          {LABELS.map((l) => (
            <div key={l.value} className="flex items-start gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
              {l.value === "human" ? (
                <span className="w-8 h-8 rounded-md border-2 border-dashed border-muted-foreground/40 flex-shrink-0" />
              ) : (
                <AILabelBadge label={l.value} size="md" className="flex-shrink-0" />
              )}
              <div>
                <p className="font-bold text-white">{l.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{l.desc}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground/70">
            Per the program's guidelines, these labels apply only to generative AI used in the sound
            recording itself — not lyrics, composition, music videos, or cover art. BASE Station goes
            further and voluntarily scores those too via the{" "}
            <Link to="/creative-ownership" className="text-[#FFC98A] underline underline-offset-2">Creative Ownership Score</Link>.{" "}
            <a href="https://www.riaa.com/music-community-introduces-new-labeling-programto-distinguish-generative-ai-in-sound-recordings/"
              target="_blank" rel="noopener noreferrer" className="text-[#FFC98A] underline underline-offset-2">
              Official announcement
            </a>.
          </p>
        </section>

        {/* Who determines the label */}
        <section className="merc-card rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-2xl text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#FF9A4D]" /> Who determines the label
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <span className="text-white font-semibold">Uploaded tracks:</span> the artist
              self-declares the label at submission, attesting to how generative AI was used in
              the recording. Like the program itself, this is a voluntary, honesty-based
              disclosure — there is no automated "percentage of AI" measurement.
            </p>
            <p>
              <span className="text-white font-semibold">Tracks created in BASE Station studios:</span>{" "}
              the label is stamped automatically by our pipeline. Fully prompt-generated music and
              AI vocals are labeled AI-Generated; AI harmonies and AI mastering of a human
              recording are labeled AI-Assisted.
            </p>
            <p>
              <span className="text-white font-semibold">Derived works</span> (stems, masters,
              mashups) inherit the most AI-intensive label in their provenance chain:
              AI-Generated &gt; AI-Assisted &gt; Human.
            </p>
          </div>
        </section>

        {/* Provenance & DDEX attribution */}
        <section className="merc-card rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-2xl text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FF9A4D]" /> Provenance manifests &amp; DDEX attribution
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Beyond the track-level label, every scored asset carries a{" "}
              <span className="text-white font-semibold">DDEX-style AI attribution profile</span> —
              granular flags recording whether lyrical content, composition, instrumentation, vocals,
              and post-production were synthetic or human. Under COS Engine 2.0, each flag is derived
              from one of five telemetry-backed creative dimensions (Content Authorship, Creative
              Direction, Sonic Identity, Vocal Identity, Craft &amp; Refinement) rather than guesswork.
              An optional{" "}
              <span className="text-white font-semibold">C2PA provenance hash</span> anchors these
              metrics to the audio container itself.
            </p>
            <p>
              Creators can export this profile as a DDEX Tag Bundle from their asset's{" "}
              <span className="text-white font-semibold">Provenance Manifest</span> in the{" "}
              <Link to="/creator-dashboard?tab=ownership" className="text-[#FFC98A] underline underline-offset-2">Ownership dashboard</Link>{" "}
              — giving distributors and partner channels verifiable, machine-readable disclosure data
              instead of a single opaque label.
            </p>
          </div>
        </section>

        {/* Songwriting engines & style references */}
        <section className="merc-card rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-2xl text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#FF9A4D]" /> Songwriting engines &amp; style references
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              The Lyrics Studio offers three engine modes — <span className="text-white font-semibold">Basic</span>,{" "}
              <span className="text-white font-semibold">Pro Songwriter</span>, and{" "}
              <span className="text-white font-semibold">243 Masters</span> (lyrics plus chord
              progressions, arrangement, and a production brief). Pro and Masters accept a
              reference writer or artist name.
            </p>
            <p>
              <span className="text-white font-semibold">Style, not identity:</span> reference
              names are converted into abstract craft descriptors only — rhyme scheme, tempo
              range, prosody, narrative tone, and genre conventions. No lyrics, recordings,
              voice, or likeness of the referenced artist are copied or simulated, and the
              artist's name never appears in your output, metadata, or credits. Users may not
              market resulting works as being "by" or "in the voice of" a real artist (see{" "}
              <Link to="/terms" className="text-[#FFC98A] underline underline-offset-2">Terms of Use §5</Link>).
            </p>
            <p>
              <span className="text-white font-semibold">Human-in-the-loop provenance:</span>{" "}
              your structural choices in these engines (references, BPM, rhyme scheme,
              arrangement decisions) are logged as human participation signals in the work's
              Provenance Manifest and Creative Ownership Score.
            </p>
          </div>
        </section>

        {/* Why + reporting */}
        <section className="merc-card rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-2xl text-white flex items-center gap-2">
            <Flag className="w-5 h-5 text-[#FF9A4D]" /> Why we do this & reporting
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              We believe listeners deserve to know how the music they hear was made, and human
              artistry deserves clear recognition. Accurate labeling also supports the music
              community's push for broad, harmonized adoption of GenAI disclosure across the
              ecosystem — a program designed to evolve as technology and requirements change.
            </p>
            <p>
              If you believe a track is mislabeled, contact us through the{" "}
              <Link to="/help" className="text-[#FFC98A] underline underline-offset-2">Help Center</Link>.
              Misrepresenting AI usage violates our{" "}
              <Link to="/terms" className="text-[#FFC98A] underline underline-offset-2">Terms of Use</Link>{" "}
              and may result in content removal or account suspension.
            </p>
          </div>
        </section>

        <div className="text-center">
          <Link to="/terms" className="inline-flex items-center gap-2 merc-button-dark rounded-full px-5 py-2.5 text-sm font-bold">
            <FileText className="w-4 h-4" /> Read the full Terms of Use
          </Link>
        </div>
      </div>
    </div>
  );
}