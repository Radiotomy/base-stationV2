import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, Music } from "lucide-react";
import RegistrationProcessSteps from "@/components/blockchain/RegistrationProcessSteps";
import ProofRegistrationCard from "@/components/dashboard/ProofRegistrationCard";

export default function ProofOfOwnershipTab({ userId }) {
  const [baseRegistrations, setBaseRegistrations] = useState([]);
  const [solanaRegistrations, setSolanaRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const base = await base44.entities.BaseTrackRegistry
        .filter({ artist_id: userId }, "-created_date", 50)
        .catch(() => []);
      const solana = await base44.entities.SolanaTrackRegistry
        .filter({ artist_id: userId }, "-created_date", 50)
        .catch(() => []);
      setBaseRegistrations(base);
      setSolanaRegistrations(solana);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const all = [
    ...baseRegistrations.map((r) => ({ reg: r, chain: "base" })),
    ...solanaRegistrations.map((r) => ({ reg: r, chain: "solana" })),
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-black flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-400" /> Proof of Ownership
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Your permanent registration records. Each one is independently verifiable — it can't be
          altered, not even by us — and comes with a certificate you can hand to any distributor.
        </p>
      </div>

      <RegistrationProcessSteps />

      {all.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
          <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No registrations yet</p>
          <p className="text-sm mt-1">Register a track from your library to create your first permanent ownership record — it's free.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {all.map(({ reg, chain }, i) => (
            <ProofRegistrationCard key={reg.id} registration={reg} blockchain={chain} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}