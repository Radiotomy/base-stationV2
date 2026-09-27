import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Solana Pay link opens the fan's own wallet (Phantom, Solflare…); the fan then
// pastes the signature so the tip can be verified on-chain.
export default function SolanaTipSender({ toWallet, onSent }) {
  const [amount, setAmount] = useState("0.05");
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const payUrl = `solana:${toWallet}?amount=${encodeURIComponent(amount)}&label=${encodeURIComponent("BASE Station tip")}`;

  const verify = async () => {
    setError("");
    setBusy(true);
    try { await onSent(signature.trim()); } catch (e) { setError(e?.message || "Verification failed"); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-muted-foreground uppercase block">Amount (SOL)</label>
      <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl" />
      <p className="text-[11px] text-muted-foreground font-mono break-all">To: {toWallet}</p>
      <a href={payUrl} className="flex items-center justify-center gap-2 w-full rounded-xl border border-border py-2 text-sm hover:bg-white/5">
        <ExternalLink className="w-4 h-4" /> 1. Open in my Solana wallet
      </a>
      <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="2. Paste the transaction signature" className="rounded-xl font-mono text-xs" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={verify} disabled={busy || !signature.trim()} className="w-full rounded-xl gap-2">
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying on Solana…</> : "3. Verify & record tip"}
      </Button>
    </div>
  );
}