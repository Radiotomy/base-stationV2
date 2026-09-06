import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import DownloadCertificateButton from "@/components/blockchain/DownloadCertificateButton";
import RegistrationStatusBadge from "@/components/blockchain/RegistrationStatusBadge";
import AudiusChainBridgeRow from "@/components/blockchain/AudiusChainBridgeRow";

export default function ProofRegistrationCard({ registration, blockchain, index }) {
  const chainColor = blockchain === "base" ? "from-blue-900 to-slate-900" : "from-violet-900 to-slate-900";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      className={`p-5 rounded-2xl bg-gradient-to-br ${chainColor} border border-white/10 hover:border-white/20 transition-all`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-bold text-white">{registration.track_title}</p>
            <RegistrationStatusBadge
              registrationId={registration.id}
              blockchainType={blockchain}
              initialStatus={registration.registration_status}
            />
          </div>
          <p className="text-xs text-white/60 mb-3">{registration.genre && <span className="capitalize">{registration.genre} · </span>}{registration.ai_tools_used || "—"}</p>
          {registration.fingerprint_hash && (
            <span className="text-xs text-white/50 font-mono">{registration.fingerprint_hash.slice(0, 16)}…</span>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {registration.registration_status === "registered" && (
            <DownloadCertificateButton
              registrationId={registration.id}
              blockchainType={blockchain}
              trackTitle={registration.track_title}
            />
          )}
          {blockchain === "base" && registration.transaction_hash && (
            <a href={`https://basescan.org/tx/${registration.transaction_hash}`} target="_blank" rel="noopener noreferrer" title="View public verification record">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg">
                <ChevronRight className="w-4 h-4 text-white/60" />
              </Button>
            </a>
          )}
          {blockchain === "solana" && registration.transaction_signature && (
            <a href={`https://solscan.io/tx/${registration.transaction_signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" title="View public verification record">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg">
                <ChevronRight className="w-4 h-4 text-white/60" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Renders itself away unless this work is BOTH anchored and released. */}
      {blockchain === "base" && (
        <div className="mt-3">
          <AudiusChainBridgeRow
            audiusTrackId={registration.audius_track_id}
            audiusPermalink={registration.audius_permalink}
            linkBasis={registration.audius_link_basis}
            txHash={registration.transaction_hash}
          />
        </div>
      )}
    </motion.div>
  );
}