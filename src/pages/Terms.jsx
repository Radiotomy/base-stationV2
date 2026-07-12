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
          <p className="text-xs text-muted-foreground">Last updated: July 12, 2026</p>
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
              BASE Station participates in the music industry's Generative-AI Labeling Program
              introduced by the RIAA, IFPI, A2IM, WIN, IMPALA, The Recording Academy, SAG-AFTRA,
              and the Human Artistry Campaign (July 2026). Under this program, every sound
              recording on the Platform carries a track-level disclosure label:
              <span className="text-white"> AI-Generated</span>,
              <span className="text-white"> AI-Assisted</span>, or
              <span className="text-white"> Human</span>.
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
              faith in accordance with the RIAA/IFPI standard.
            </p>
            <p>
              <span className="text-white font-semibold">3.3 Platform-applied labels.</span>{" "}
              Content created with BASE Station's generative studios is labeled automatically by
              the Platform based on the tools used. Derived works inherit the most AI-intensive
              label in their provenance chain.
            </p>
            <p>
              <span className="text-white font-semibold">3.4 Scope.</span> These labels apply only
              to generative AI use in sound recordings and do not currently cover lyrics,
              composition, music videos, or cover art.
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

          <Section n={4} title="Acceptable Use">
            <p>
              You may not upload content that is unlawful, infringing, or impersonates another
              artist's voice or likeness without authorization. You may not manipulate charts,
              votes, or play counts, or use the Platform to train external AI models on other
              users' content without permission.
            </p>
          </Section>

          <Section n={5} title="Credits & Purchases">
            <p>
              Generation credits are consumed by AI studio features. Credits are non-refundable
              except where required by law. Provider availability and credit costs may change.
            </p>
          </Section>

          <Section n={6} title="Termination">
            <p>
              We may suspend or terminate accounts that violate these Terms, including violations
              of the AI Content Transparency obligations in Section 3.
            </p>
          </Section>

          <Section n={7} title="Changes to These Terms">
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