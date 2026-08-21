import { Fingerprint, Clock, Scale } from 'lucide-react';

// The single public statement of what BASE Station's provenance records can and
// cannot establish. Stated plainly and in one place, because a provenance claim
// that overreaches is worth less than a narrow one a rights holder can rely on:
// a watermark, a timestamp and a score are each EVIDENCE, and none of them
// adjudicates authorship, copyright or a competing claim.
const LIMITS = [
  {
    icon: Fingerprint,
    title: 'A mark identifies a recording',
    body: 'A BASE Mark identifies the audio it was embedded in, and survives re-encoding, compression and editing. It records which registered work a piece of audio came from. It does not, on its own, identify the human who wrote it.',
  },
  {
    icon: Clock,
    title: 'A timestamp records a moment',
    body: 'An on-chain registration shows that a specific recording was registered at a specific time, by a specific account, and that the entry has not been edited since. It does not prove the work was first.',
  },
  {
    icon: Scale,
    title: 'A score and a label are declarations',
    body: 'A Creative Ownership Score measures the creative input we observed in our own studios. A GenAI label on an upload is the artist\u2019s own attestation. Both are disclosure — neither grants copyright nor settles a dispute.',
  },
];

export default function EvidenceBoundary() {
  return (
    <section className="space-y-4">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <h2 className="font-display text-2xl text-foreground">
          Provenance is evidence. It is not ownership.
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every record BASE Station creates has a narrow, specific job. Together they build an
          evidence trail you can hand to a distributor, a platform or an attorney. None of them
          grants copyright, resolves competing claims, or replaces legal advice.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {LIMITS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-5 space-y-2">
            <Icon className="w-4 h-4 text-[#FFC98A]" />
            <p className="text-sm font-bold text-foreground">{title}</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground/70 text-center max-w-2xl mx-auto leading-relaxed">
        Keep more than a record: hold on to your project files, drafts, session history, contributor
        agreements and dated correspondence. A provenance record is most useful as one strong part of
        that trail. For statutory protection in the US, register with the Copyright Office — that is
        something no platform can do for you.
      </p>
    </section>
  );
}