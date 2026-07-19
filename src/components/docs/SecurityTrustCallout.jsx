import { Lock, Database, Link2, ShieldCheck } from 'lucide-react';

const POINTS = [
  {
    icon: Database,
    title: 'Immutable IPFS storage',
    text: 'Registered provenance bundles (audio, cover art, and metadata JSON) are pinned to IPFS via Pinata. Content addressing means any alteration produces a different CID — records cannot be retroactively edited.',
  },
  {
    icon: Link2,
    title: 'On-chain anchoring',
    text: 'The provenance hash and metadata URI are written into blockchain registry records on Base or Solana at registration time, creating a tamper-evident "ground truth" snapshot of the asset\u2019s state.',
  },
  {
    icon: ShieldCheck,
    title: 'Cryptographic binding',
    text: 'The c2pa_provenance_hash (SHA-256) binds the COS metrics to the audio container itself, so any downstream party can detect tampering without trusting the platform.',
  },
  {
    icon: Lock,
    title: 'Hardened ingestion',
    text: 'The pinning pipeline validates every source URL against internal, loopback, and IP-literal targets (SSRF protection), and all pinning credentials are held server-side — never exposed to clients.',
  },
];

export default function SecurityTrustCallout() {
  return (
    <div className="rounded-2xl border border-[#FF9A4D]/25 bg-[#FF9A4D]/[0.04] p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="w-5 h-5 text-[#FF9A4D]" />
        <h2 className="text-xl font-display text-foreground">Security & Trust</h2>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
        Provenance data is the backbone of the BASE Station standard — it is treated as critical infrastructure,
        not ordinary metadata. Four layers protect its integrity and permanence:
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {POINTS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="flex gap-3">
              <Icon className="w-5 h-5 text-[#FFC98A] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{p.title}</h3>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">{p.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}