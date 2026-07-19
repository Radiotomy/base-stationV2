import { Wand2, Fingerprint, FileLock2, Link2, ShieldCheck } from "lucide-react";

const STEPS = [
  {
    icon: Wand2,
    title: "1. Create & Iterate",
    text: "Generate in any studio. Every prompt, reference upload, lyric edit, and iteration is logged as human participation toward your Creative Ownership Score.",
  },
  {
    icon: Fingerprint,
    title: "2. Manifest & COS",
    text: "On registration, your COS, DDEX AI-attribution flags, and asset metadata are compiled into a Provenance Manifest and fingerprinted with SHA-256.",
  },
  {
    icon: FileLock2,
    title: "3. Pin to IPFS",
    text: "The manifest is pinned to IPFS, giving your provenance record a permanent, content-addressed home that anyone can verify.",
  },
  {
    icon: Link2,
    title: "4. Anchor on Base",
    text: "The platform wallet signs and broadcasts the transaction — the fingerprint and IPFS URI are anchored on the Base blockchain. No wallet, no crypto, no gas fees for you.",
  },
  {
    icon: ShieldCheck,
    title: "5. Prove It Anywhere",
    text: "Download your certificate, view the record on BaseScan, and export a DDEX bundle or ID3 tags to hand distributors verifiable proof of your creative ownership.",
  },
];

export default function RegistrationProcessSteps() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 mb-10">
      <h2 className="text-lg font-black text-foreground mb-1">How Registration Works</h2>
      <p className="text-sm text-muted-foreground mb-5">
        One click, ~20 seconds, zero crypto knowledge required — Base Station covers all blockchain fees.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="p-4 rounded-xl bg-secondary/40 border border-border/50">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-sm font-bold text-foreground mb-1">{s.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}