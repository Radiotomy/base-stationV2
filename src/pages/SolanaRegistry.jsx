import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Shield, ExternalLink, Plus, Music, CheckCircle, Clock, Globe, Copy, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import WalletConnectButton from "@/components/solana/WalletConnectButton";
import RegisterTrackModal from "@/components/solana/RegisterTrackModal";
import { toast } from "sonner";

const STATUS_STYLE = {
  registered: { badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", label: "✅ Registered", dot: "bg-emerald-400" },
  pending: { badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", label: "⏳ Pending", dot: "bg-yellow-400" },
  failed: { badge: "bg-red-500/20 text-red-300 border-red-500/30", label: "❌ Failed", dot: "bg-red-400" },
};

export default function SolanaRegistry() {
  const [user, setUser] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    const init = async () => {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);
      if (u) {
        const regs = await base44.entities.SolanaTrackRegistry.filter({ artist_id: u.id }, "-created_date", 50);
        setRegistrations(regs);
        // Check if phantom already connected
        if (window.solana?.isConnected) {
          try {
            const resp = await window.solana.connect({ onlyIfTrusted: true });
            setWalletAddress(resp.publicKey.toString());
          } catch {}
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const loadRegistrations = async () => {
    if (!user) return;
    const regs = await base44.entities.SolanaTrackRegistry.filter({ artist_id: user.id }, "-created_date", 50);
    setRegistrations(regs);
  };

  const handleDisconnect = async () => {
    await window.solana?.disconnect?.();
    setWalletAddress(null);
    toast.success("Wallet disconnected");
  };

  const shortAddr = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
  const shortSig = (sig) => sig ? `${sig.slice(0, 8)}…${sig.slice(-6)}` : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-purple-950 pt-20 pb-16 px-6">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-purple-600/10 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 bg-violet-500/20 text-violet-300 border-violet-500/30 px-4 py-1.5 text-xs tracking-widest uppercase">
              ⛓️ Solana Provenance
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
              Own Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">Music</span>
            </h1>
            <p className="text-violet-200/70 text-lg max-w-2xl mx-auto mb-8">
              Register your AI tracks on the Solana blockchain. Immutable authorship proof — no one can claim your music ever again.
            </p>

            {/* Why it matters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left mt-8">
              {[
                { icon: Shield, title: "Immutable Proof", desc: "Your fingerprint is permanently written to Solana. It can never be altered or removed." },
                { icon: Globe, title: "Decentralized", desc: "Not stored on any single server. Your proof exists as long as Solana exists." },
                { icon: CheckCircle, title: "Timestamped", desc: "Blockchain timestamps prove exactly when you created and registered your track." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
                  <Icon className="w-6 h-6 text-violet-400 mb-2" />
                  <p className="font-bold text-white text-sm mb-1">{title}</p>
                  <p className="text-white/50 text-xs">{desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {!user ? (
          <div className="text-center py-20">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h2 className="text-2xl font-black text-foreground mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">You need an AIVTV account to register tracks on-chain.</p>
            <Button onClick={() => base44.auth.redirectToLogin(window.location.href)} className="rounded-full bg-purple-600 hover:bg-purple-500 text-white px-8">
              Sign In
            </Button>
          </div>
        ) : (
          <>
            {/* Wallet + Register CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 p-5 rounded-2xl bg-card border border-border">
              <div>
                <p className="font-bold text-foreground mb-0.5">Phantom Wallet</p>
                <p className="text-sm text-muted-foreground">
                  {walletAddress ? `Connected: ${shortAddr(walletAddress)}` : "Connect your Phantom wallet to register tracks"}
                </p>
              </div>
              <div className="flex gap-3">
                <WalletConnectButton
                  walletAddress={walletAddress}
                  onConnect={setWalletAddress}
                  onDisconnect={handleDisconnect}
                />
                {walletAddress && (
                  <Button onClick={() => setShowRegisterModal(true)}
                    className="rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold gap-2">
                    <Plus className="w-4 h-4" /> Register Track
                  </Button>
                )}
              </div>
            </div>

            {/* How It Works */}
            {!walletAddress && (
              <div className="mb-8 p-6 rounded-2xl bg-card border border-dashed border-violet-500/30">
                <h3 className="font-black text-foreground mb-4">How to Get Started</h3>
                <div className="space-y-3">
                  {[
                    { step: "1", text: "Install the Phantom wallet browser extension from phantom.app" },
                    { step: "2", text: "Create a Solana wallet and get some free devnet SOL from faucet.solana.com" },
                    { step: "3", text: "Click \"Connect Phantom\" above and approve the connection" },
                    { step: "4", text: "Click \"Register Track\" — fill in your details and approve the transaction" },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step}</div>
                      <p className="text-sm text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-3 flex-wrap">
                  <a href="https://phantom.app" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="rounded-full gap-1 text-xs">
                      <ExternalLink className="w-3 h-3" /> Get Phantom
                    </Button>
                  </a>
                  <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="rounded-full gap-1 text-xs">
                      <ExternalLink className="w-3 h-3" /> Free Devnet SOL
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {/* Registrations List */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-black text-foreground">Your Registered Tracks</h2>
                <Badge variant="outline" className="text-xs">{registrations.length} tracks</Badge>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array(3).fill(0).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
                </div>
              ) : registrations.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-border rounded-2xl text-muted-foreground">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No tracks registered yet</p>
                  <p className="text-sm mt-1">
                    {walletAddress ? "Click \"Register Track\" to begin" : "Connect your wallet to get started"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {registrations.map((reg, i) => {
                    const s = STATUS_STYLE[reg.registration_status] || STATUS_STYLE.pending;
                    return (
                      <motion.div key={reg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="p-5 rounded-2xl bg-card border border-border hover:border-violet-500/20 transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-violet-800 to-purple-900 flex-shrink-0">
                              {reg.cover_image_url ? (
                                <img src={reg.cover_image_url} alt={reg.track_title} className="w-full h-full object-cover" />
                              ) : (
                                <Music className="w-5 h-5 m-3.5 text-white/30" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="font-black text-foreground truncate">{reg.track_title}</p>
                                <Badge className={`text-xs ${s.badge}`}>{s.label}</Badge>
                              </div>
                              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                                {reg.genre && <span className="capitalize">{reg.genre}</span>}
                                {reg.ai_tools_used && <span>{reg.ai_tools_used}</span>}
                                {reg.registered_at && <span>{new Date(reg.registered_at).toLocaleDateString()}</span>}
                              </div>
                              {reg.fingerprint_hash && (
                                <div className="mt-2 flex items-center gap-2">
                                  <p className="text-xs text-muted-foreground font-mono">{reg.fingerprint_hash.slice(0, 24)}…</p>
                                  <button onClick={() => { navigator.clipboard.writeText(reg.fingerprint_hash); toast.success("Hash copied!"); }}
                                    className="text-muted-foreground hover:text-foreground transition-colors">
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {reg.track_url && (
                              <a href={reg.track_url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline" className="rounded-xl h-8 gap-1 text-xs">
                                  <Music className="w-3 h-3" /> Listen
                                </Button>
                              </a>
                            )}
                            {reg.transaction_signature && (
                              <a href={`https://solscan.io/tx/${reg.transaction_signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline" className="rounded-xl h-8 gap-1 text-xs">
                                  <ExternalLink className="w-3 h-3" /> Solscan
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                        {reg.transaction_signature && (
                          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            <p className="text-xs text-muted-foreground">Tx: {shortSig(reg.transaction_signature)}</p>
                            <button onClick={() => { navigator.clipboard.writeText(reg.transaction_signature); toast.success("Signature copied!"); }}
                              className="text-muted-foreground hover:text-foreground transition-colors ml-1">
                              <Copy className="w-3 h-3" />
                            </button>
                            <span className="text-xs text-muted-foreground ml-1">· Solana Devnet</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showRegisterModal && (
        <RegisterTrackModal
          walletAddress={walletAddress}
          user={user}
          onClose={() => setShowRegisterModal(false)}
          onRegistered={() => { setShowRegisterModal(false); loadRegistrations(); }}
        />
      )}
    </div>
  );
}