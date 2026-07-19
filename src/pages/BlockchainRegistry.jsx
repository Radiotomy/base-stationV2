import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Shield, Wallet, Music, CheckCircle, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DownloadCertificateButton from "@/components/blockchain/DownloadCertificateButton";
import RegistrationStatusBadge from "@/components/blockchain/RegistrationStatusBadge";
import RegistrationProcessSteps from "@/components/blockchain/RegistrationProcessSteps";

export default function BlockchainRegistry() {
  const [user, setUser] = useState(null);
  const [baseRegistrations, setBaseRegistrations] = useState([]);
  const [solanaRegistrations, setSolanaRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);

      if (u) {
        const [base, solana] = await Promise.all([
          base44.entities.BaseTrackRegistry.filter({ artist_id: u.id }, "-created_date", 50),
          base44.entities.SolanaTrackRegistry.filter({ artist_id: u.id }, "-created_date", 50),
        ]);
        setBaseRegistrations(base);
        setSolanaRegistrations(solana);
      }

      setLoading(false);
    };
    load();
  }, []);

  const totalRegistrations = baseRegistrations.length + solanaRegistrations.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 pt-20 pb-16 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 bg-blue-500/20 text-blue-300 border-blue-500/30 px-4 py-1.5 text-xs tracking-widest uppercase font-semibold">
              ⛓️ Multi-Chain Provenance
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
              Own Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Music</span>
            </h1>
            <p className="text-blue-200/70 text-lg max-w-xl mx-auto">
              Register your AI tracks on Base (primary) or Solana. Immutable authorship proof, decentralized ownership, forever.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {!user ? (
          <div className="text-center py-20 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Sign in to view and manage your registrations</p>
            <Button onClick={() => base44.auth.redirectToLogin()} className="mt-4 rounded-full bg-blue-600 hover:bg-blue-500">
              Sign In
            </Button>
          </div>
        ) : loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <RegistrationProcessSteps />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
              <div className="p-5 rounded-2xl bg-card border border-border text-center">
                <p className="text-3xl font-black text-foreground">{baseRegistrations.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Base Registrations</p>
              </div>
              <div className="p-5 rounded-2xl bg-card border border-border text-center">
                <p className="text-3xl font-black text-foreground">{solanaRegistrations.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Solana Registrations</p>
              </div>
              <div className="p-5 rounded-2xl bg-card border border-border text-center col-span-2 md:col-span-1">
                <p className="text-3xl font-black text-foreground">{totalRegistrations}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Registered</p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="base" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/40">
                <TabsTrigger value="base" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <span className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Base (Primary)
                  </span>
                </TabsTrigger>
                <TabsTrigger value="solana" className="rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Solana (Secondary)
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="base" className="space-y-4">
                {baseRegistrations.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
                    <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">No Base registrations yet</p>
                    <p className="text-sm mt-1">Register your first track to establish on-chain ownership</p>
                  </div>
                ) : (
                  baseRegistrations.map((reg, i) => (
                    <RegistrationCard key={reg.id} registration={reg} blockchain="base" index={i} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="solana" className="space-y-4">
                {solanaRegistrations.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
                    <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">No Solana registrations yet</p>
                    <p className="text-sm mt-1">Register on Solana as a secondary backup</p>
                  </div>
                ) : (
                  solanaRegistrations.map((reg, i) => (
                    <RegistrationCard key={reg.id} registration={reg} blockchain="solana" index={i} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

function RegistrationCard({ registration, blockchain, index }) {
  const statusIcons = {
    registered: CheckCircle,
    pending: Clock,
    failed: AlertCircle,
  };
  const StatusIcon = statusIcons[registration.registration_status] || CheckCircle;
  const chainColor = blockchain === "base" ? "from-blue-900 to-slate-900" : "from-violet-900 to-slate-900";
  const chainAccent = blockchain === "base" ? "text-blue-400" : "text-violet-400";

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
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 font-mono">{registration.fingerprint_hash.slice(0, 16)}…</span>
            </div>
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
            <a href={`https://basescan.org/tx/${registration.transaction_hash}`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg">
                <ChevronRight className="w-4 h-4 text-white/60" />
              </Button>
            </a>
          )}
          {blockchain === "solana" && registration.transaction_signature && (
            <a href={`https://solscan.io/tx/${registration.transaction_signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg">
                <ChevronRight className="w-4 h-4 text-white/60" />
              </Button>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}