import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

const Section = ({ n, title, children }) => (
  <section className="space-y-2">
    <h2 className="font-display text-xl text-white">{n}. {title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </section>
);

export default function Terms() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-[#FFC98A] text-xs font-bold tracking-wider uppercase">
            <FileText className="w-3.5 h-3.5" /> Legal
          </div>
          <h1 className="font-display text-4xl text-white">Terms of Use</h1>
          <p className="text-xs text-muted-foreground">Last updated: July 18, 2026</p>
        </header>

        <div className="merc-card rounded-2xl p-6 md:p-8 space-y-8">
          <Section n={1} title="Acceptance of Terms">
            <p>
              By accessing or using BASE Station ("the Platform"), you agree to be bound by these
              Terms of Use. If you do not agree, do not use the Platform.
            </p>
          </Section>

          <Section n={2} title="User Content & Ownership">
            <p>
              You retain ownership of the music, lyrics, artwork, and other content you upload or
              create on the Platform. By submitting content, you grant BASE Station a
              non-exclusive, worldwide license to host, stream, display, and distribute that
              content within the Platform (including radio channels, charts, and playlists).
            </p>
            <p>
              You represent that you own or control all rights to the content you submit and that
              it does not infringe the rights of any third party.
            </p>
          </Section>

          <Section n={3} title="AI Content Transparency">
            <p>
              On July 10, 2026, IFPI, RIAA, A2IM, WIN, IMPALA, The Grammys, SAG-AFTRA, and the
              Human Artistry Campaign introduced a voluntary, track-level labeling program to
              distinguish generative AI (GenAI) in sound recordings. BASE Station voluntarily
              aligns its labeling with that program. Every sound recording on the Platform carries
              a disclosure label:
              <span className="text-white"> AI-Generated</span>,
              <span className="text-white"> AI-Assisted</span>, or
              <span className="text-white"> Human</span> (the Platform's designation for
              recordings in which no generative AI was used; the program itself defines the two
              GenAI labels).
            </p>
            <p>
              <span className="text-white font-semibold">3.1 Duty of accurate disclosure.</span>{" "}
              When you upload a sound recording, you must accurately declare the level of
              generative AI involvement. "AI-Generated" means generative AI created the entirety
              or the primary portion of the recording's creative elements. "AI-Assisted" means the
              recording was created substantially by humans, with generative AI used for some
              expressive elements. "Human" means no generative AI was used in the recording.
            </p>
            <p>
              <span className="text-white font-semibold">3.2 Warranty.</span> By submitting
              content, you warrant that your self-declared label is accurate and made in good
              faith, consistent with the program's published guidelines. As the program itself is
              voluntary and honesty-based, no automated "percentage of AI" measurement is applied.
            </p>
            <p>
              <span className="text-white font-semibold">3.3 Platform-applied labels.</span>{" "}
              Content created with BASE Station's generative studios is labeled automatically by
              the Platform based on the tools used. Derived works inherit the most AI-intensive
              label in their provenance chain.
            </p>
            <p>
              <span className="text-white font-semibold">3.4 Scope.</span> Per the program's
              guidelines, these labels apply only to generative AI use in sound recordings and do
              not currently cover lyrics, composition, music videos, or cover art. The program is
              designed to evolve as technology and requirements change, and the Platform may
              update its labeling practices accordingly.
            </p>
            <p>
              <span className="text-white font-semibold">3.5 Enforcement.</span> BASE Station
              provides the tools for disclosure but is not liable for the accuracy of a user's
              self-declaration. Misrepresenting AI usage may result in re-labeling, content
              removal, or account suspension. Learn more on our{" "}
              <Link to="/transparency" className="text-[#FFC98A] underline underline-offset-2">
                AI Transparency page
              </Link>.
            </p>
          </Section>

          <Section n={4} title="Creative Ownership Score (COS)">
            <p>
              In addition to the labeling program described in Section 3, the Platform assigns a
              voluntary <span className="text-white">Creative Ownership Score</span> (0–100) to
              content generated in BASE Station studios, reflecting recorded signals of human
              creative input (such as user-provided lyrics, prompt depth, reference uploads,
              saved personas, style choices, and iterative refinement). The COS extends the
              spirit of GenAI transparency to lyrics, cover art, and video, which the labeling
              program does not currently cover.
            </p>
            <p>
              <span className="text-white font-semibold">4.1 Informational only.</span> The COS is
              a platform-level transparency metric. It is not part of the music community's
              labeling program, and it does not constitute a legal determination of authorship,
              copyright ownership, or registrability of any work. You are responsible for your
              own legal assessments regarding rights in AI-generated or AI-assisted content.
            </p>
            <p>
              <span className="text-white font-semibold">4.2 Methodology changes.</span> Scoring
              signals and thresholds may be updated over time as the labeling program and industry
              practices evolve. Learn more on the{" "}
              <Link to="/creative-ownership" className="text-[#FFC98A] underline underline-offset-2">
                Creative Ownership page
              </Link>.
            </p>
          </Section>

          <Section n={5} title="Style References in Songwriting Studios">
            <p>
              The Platform's songwriting engines (including Pro Songwriter and 243 Masters) allow
              you to name a reference writer or artist. Reference names are converted into
              abstract craft descriptors only — rhyme scheme, tempo range, prosody, narrative
              tone, and genre conventions. No lyrics, sound recordings, voice, or likeness of the
              referenced artist are copied, reproduced, or simulated, and the referenced artist's
              name is never placed in your output, metadata, or credits.
            </p>
            <p>
              <span className="text-white font-semibold">5.1 Your obligations.</span> You may not
              market, title, tag, or distribute any resulting work as being "by," "featuring," or
              "in the voice of" a real artist, or otherwise imply endorsement or affiliation. You
              must carry the AI disclosure label assigned to the work through distribution.
            </p>
            <p>
              <span className="text-white font-semibold">5.2 Provenance logging.</span> Your
              structural choices (references, BPM, rhyme scheme, arrangement selections) are
              recorded as human participation signals in the work's Provenance Manifest and
              Creative Ownership Score.
            </p>
          </Section>

          <Section n={6} title="Acceptable Use">
            <p>
              You may not upload content that is unlawful, infringing, or impersonates another
              artist's voice or likeness without authorization. You may not manipulate charts,
              votes, or play counts, or use the Platform to train external AI models on other
              users' content without permission.
            </p>
          </Section>

          <Section n={7} title="Credits & Purchases">
            <p>
              Generation credits are consumed by AI studio features. Credits are non-refundable
              except where required by law. Provider availability and credit costs may change.
            </p>
          </Section>

          <Section n={8} title="Termination">
            <p>
              We may suspend or terminate accounts that violate these Terms, including violations
              of the AI Content Transparency obligations in Section 3.
            </p>
          </Section>

          <Section n={9} title="Changes to These Terms">
            <p>
              We may update these Terms from time to time. Continued use of the Platform after
              changes take effect constitutes acceptance of the revised Terms.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}