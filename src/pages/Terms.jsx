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
          <p className="text-xs text-muted-foreground">Last updated: July 19, 2026</p>
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

          <Section n={6} title="Eligibility & Account Responsibility">
            <p>
              You must be at least 13 years of age (or the minimum age of digital consent in your
              jurisdiction) to use the Platform, and at least 18 to make purchases, send tips, or
              register content on-chain. You are responsible for maintaining the confidentiality
              of your account credentials and for all activity that occurs under your account.
            </p>
          </Section>

          <Section n={7} title="Acceptable Use">
            <p>
              You may not upload content that is unlawful, infringing, or impersonates another
              artist's voice or likeness without authorization. You may not manipulate charts,
              votes, or play counts, or use the Platform to train external AI models on other
              users' content without permission. You may not attempt to probe, scan, disrupt, or
              gain unauthorized access to the Platform, its infrastructure, or other users'
              accounts, or use automated means to scrape or bulk-download Platform content.
            </p>
          </Section>

          <Section n={8} title="Credits, Purchases & Tips">
            <p>
              Generation credits are consumed by AI studio features. Credits are non-refundable
              except where required by law, have no cash value, and are not transferable or
              redeemable. Provider availability and credit costs may change. Tips sent to
              creators are voluntary gifts between users; BASE Station is not a party to, and
              assumes no responsibility for, disputes between tippers and recipients.
            </p>
          </Section>

          <Section n={9} title="Third-Party AI Providers & Services">
            <p>
              Generative features are powered in part by third-party AI providers and services.
              BASE Station does not control and is not responsible for the output, availability,
              accuracy, or training practices of third-party providers. AI-generated output may be
              inaccurate, unexpected, or similar to output generated for other users, and is
              provided without any warranty of originality, non-infringement, or fitness for a
              particular purpose. You are solely responsible for reviewing and clearing any output
              before commercial use or distribution.
            </p>
          </Section>

          <Section n={10} title="Blockchain Registration & Provenance Records">
            <p>
              On-chain registration anchors a cryptographic fingerprint of your content's
              provenance metadata to a public blockchain. Such records are{" "}
              <span className="text-white">informational timestamps only</span>: they do not
              constitute copyright registration, a legal determination of authorship or ownership,
              legal advice, or a guarantee of enforceability in any proceeding. Blockchain records
              are permanent and cannot be deleted or modified by BASE Station. BASE Station makes
              no warranty regarding the continued operation of any blockchain network, IPFS
              gateway, or third-party explorer, and is not liable for any loss arising from your
              reliance on on-chain records.
            </p>
          </Section>

          <Section n={11} title="Copyright Complaints (DMCA)">
            <p>
              We respect intellectual property rights and respond to notices that comply with the
              Digital Millennium Copyright Act (17 U.S.C. § 512). If you believe content on the
              Platform infringes your copyright, send a written notice to{" "}
              <a href="mailto:contact@basestation.live" className="text-[#FFC98A] underline underline-offset-2">
                contact@basestation.live
              </a>{" "}
              including: (a) identification of the copyrighted work; (b) the URL or location of
              the allegedly infringing material; (c) your contact information; (d) a good-faith
              statement that the use is unauthorized; (e) a statement, under penalty of perjury,
              that the notice is accurate and you are authorized to act; and (f) your physical or
              electronic signature. We may remove content, notify the uploader, accept
              counter-notices, and terminate repeat infringers, in each case in our discretion and
              consistent with applicable law.
            </p>
          </Section>

          <Section n={12} title="Disclaimer of Warranties">
            <p className="uppercase text-[13px]">
              The Platform and all content, features, AI output, scores, labels, manifests, and
              services are provided "as is" and "as available," without warranties of any kind,
              whether express, implied, or statutory, including without limitation implied
              warranties of merchantability, fitness for a particular purpose, title,
              non-infringement, accuracy, or uninterrupted or error-free operation. No advice or
              information obtained from the Platform, its documentation, or its personnel creates
              any warranty. Nothing on the Platform constitutes legal, financial, or professional
              advice.
            </p>
          </Section>

          <Section n={13} title="Limitation of Liability">
            <p className="uppercase text-[13px]">
              To the maximum extent permitted by law, in no event shall BASE Station, Radiotomy,
              or any of their founders, owners, officers, directors, members, managers, employees,
              contractors, agents, licensors, partners, or affiliates (collectively, the "BASE
              Station Parties") be liable for any indirect, incidental, special, consequential,
              exemplary, or punitive damages, or any loss of profits, revenue, data, goodwill,
              content, or business opportunity, arising out of or relating to your use of or
              inability to use the Platform, any AI output, any disclosure label or ownership
              score, any blockchain record, or any third-party service, even if advised of the
              possibility of such damages.
            </p>
            <p className="uppercase text-[13px]">
              The aggregate liability of the BASE Station Parties for all claims arising out of or
              relating to these Terms or the Platform shall not exceed the greater of (a) the
              amounts you paid to BASE Station in the twelve (12) months preceding the claim, or
              (b) one hundred U.S. dollars (US$100). Some jurisdictions do not allow certain
              limitations; in those jurisdictions, liability is limited to the fullest extent
              permitted by law.
            </p>
          </Section>

          <Section n={14} title="Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless the BASE Station Parties from and
              against any claims, damages, losses, liabilities, costs, and expenses (including
              reasonable attorneys' fees) arising out of or relating to: (a) your content,
              including any claim that it infringes or misappropriates third-party rights; (b)
              your AI disclosure declarations; (c) your use or distribution of AI output; (d) your
              violation of these Terms or applicable law; or (e) your interactions or disputes
              with other users, distributors, or platforms.
            </p>
          </Section>

          <Section n={15} title="Dispute Resolution; Arbitration; Class Action Waiver">
            <p>
              Any dispute arising out of or relating to these Terms or the Platform that cannot be
              resolved informally within thirty (30) days of written notice to{" "}
              <a href="mailto:contact@basestation.live" className="text-[#FFC98A] underline underline-offset-2">
                contact@basestation.live
              </a>{" "}
              shall be resolved by binding individual arbitration administered under the rules of
              a recognized arbitration provider, rather than in court, except that either party
              may bring an individual claim in small-claims court or seek injunctive relief for
              intellectual-property violations.
            </p>
            <p className="uppercase text-[13px]">
              You and BASE Station each waive the right to a jury trial and the right to
              participate in any class action, class arbitration, or representative proceeding.
              All claims must be brought in the parties' individual capacities.
            </p>
            <p>
              Any claim must be filed within one (1) year after the cause of action arises, or it
              is permanently barred, to the extent permitted by applicable law.
            </p>
          </Section>

          <Section n={16} title="Governing Law">
            <p>
              These Terms are governed by the laws of the State of Texas, United States, without
              regard to conflict-of-law principles. Subject to Section 15, the state and federal
              courts located in Texas shall have exclusive jurisdiction over any permitted court
              proceedings.
            </p>
          </Section>

          <Section n={17} title="Termination">
            <p>
              We may suspend or terminate accounts that violate these Terms, including violations
              of the AI Content Transparency obligations in Section 3, at any time and without
              prior notice. Sections 2, 12–16, and 18 survive termination.
            </p>
          </Section>

          <Section n={18} title="Miscellaneous">
            <p>
              If any provision of these Terms is held unenforceable, it will be modified to the
              minimum extent necessary and the remaining provisions will remain in full force.
              These Terms, together with the{" "}
              <Link to="/transparency" className="text-[#FFC98A] underline underline-offset-2">AI Transparency</Link>{" "}
              and{" "}
              <Link to="/creative-ownership" className="text-[#FFC98A] underline underline-offset-2">Creative Ownership</Link>{" "}
              policies, constitute the entire agreement between you and BASE Station regarding the
              Platform. Our failure to enforce any right is not a waiver of that right. You may
              not assign these Terms; we may assign them in connection with a merger, acquisition,
              or sale of assets.
            </p>
          </Section>

          <Section n={19} title="Changes to These Terms">
            <p>
              We may update these Terms from time to time. Continued use of the Platform after
              changes take effect constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section n={20} title="Contact">
            <p>
              Questions about these Terms or any legal notice may be directed to{" "}
              <a href="mailto:contact@basestation.live" className="text-[#FFC98A] underline underline-offset-2">
                contact@basestation.live
              </a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}