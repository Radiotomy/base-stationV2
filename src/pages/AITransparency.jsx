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
            <ShieldCheck className="w-3.5 h-3.5" /> RIAA / IFPI Compliant
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-white">AI Transparency</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            BASE Station labels every sound recording under the music industry's Generative-AI
            Labeling Program (RIAA, IFPI, A2IM, WIN, IMPALA, The Recording Academy, SAG-AFTRA &
            the Human Artistry Campaign — July 2026).
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
            Per the industry standard, these labels apply only to generative AI used in the sound
            recording itself. They do not currently cover AI used in lyrics, composition, music
            videos, or cover art.
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
              the recording. This is an honesty-based disclosure required by the industry
              standard — there is no automated "percentage of AI" measurement.
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

        {/* Why + reporting */}
        <section className="merc-card rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-2xl text-white flex items-center gap-2">
            <Flag className="w-5 h-5 text-[#FF9A4D]" /> Why we do this & reporting
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              We believe listeners deserve to know how the music they hear was made, and human
              artistry deserves clear recognition. Accurate labeling also supports the industry's
              transition to standardized AI disclosure.
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