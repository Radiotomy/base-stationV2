import { Link2 } from 'lucide-react';

const PIPELINE = [
  {
    step: '1. Telemetry Collection',
    detail:
      'As a creator generates and iterates in the studios, the orchestration layer records participation signals — own lyrics (+40), detailed prompts (+15), reference uploads (+15), personas (+10), style selections (+10), iteration (+10) — building the 0–100 Creative Ownership Score.',
  },
  {
    step: '2. Manifest Compilation',
    detail:
      'On registration, the asset metadata, COS/HPS scores, participation-signal breakdown, and DDEX AI-attribution flags are compiled into a Provenance Manifest JSON. A SHA-256 fingerprint of the normalized track metadata is computed.',
  },
  {
    step: '3. IPFS Pinning',
    detail:
      'The manifest is pinned to IPFS via Pinata, producing a permanent, content-addressed metadata_uri (ipfs://…) and a public gateway URL for verification.',
  },
  {
    step: '4. On-Chain Anchoring',
    detail:
      'The platform wallet signs a transaction embedding the fingerprint hash and IPFS URI, broadcast to Base mainnet. Gas is platform-paid — the artist needs no wallet or crypto. Failed anchors are queued and retried automatically.',
  },
  {
    step: '5. Registry Finalization',
    detail:
      'The registry record is updated with transaction_hash, wallet_address, metadata_uri, and status=registered. Certificates, BaseScan links, DDEX bundles, and ID3v2 tags become available for distribution workflows.',
  },
];

export default function OnChainRegistrationSection() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-5 h-5 text-[#FF9A4D]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Standards</span>
        </div>
        <h1 className="text-3xl font-black text-foreground mb-3">On-Chain Registration Pipeline</h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          BASE Station anchors every registered track's provenance on the Base blockchain using a
          platform-sponsored wallet. The pipeline turns studio telemetry into an immutable,
          publicly verifiable ownership record — with zero crypto friction for the artist.
        </p>
      </div>

      <div className="space-y-3">
        {PIPELINE.map((p) => (
          <div key={p.step} className="rounded-xl border border-border bg-card p-5">
            <p className="font-bold text-foreground text-sm mb-1.5">{p.step}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{p.detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-bold text-foreground text-sm mb-2">On-chain record contents</p>
        <pre className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">{`{
  "fingerprint_hash": "sha256(normalized track metadata)",
  "metadata_uri": "ipfs://Qm…",           // full Provenance Manifest
  "network": "base-mainnet",
  "wallet_address": "0x…",                 // platform registrar wallet
  "transaction_hash": "0x…"                // verify on basescan.org
}`}</pre>
        <p className="text-xs text-muted-foreground mt-3">
          Verification: recompute the SHA-256 fingerprint from the track metadata, fetch the manifest
          from the IPFS gateway, and compare both against the values embedded in the Base transaction's
          calldata. Any mutation of the underlying metadata breaks the fingerprint match.
        </p>
      </div>

      <div className="rounded-xl border border-[#FF9A4D]/20 bg-[#FF9A4D]/5 p-5">
        <p className="font-bold text-foreground text-sm mb-1.5">Platform-paid model</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Transactions are signed by the platform registrar wallet, not the artist. This removes the
          seed-phrase / gas-fee barrier entirely while keeping the record public and independently
          verifiable. Artists retain full attribution — their identity is embedded in the manifest,
          and the certificate binds the registration to their account.
        </p>
      </div>
    </div>
  );
}