import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Decimal ETH string → hex wei, without floating-point loss.
const toWeiHex = (eth) => {
  const [w, f = ""] = String(eth).split(".");
  return "0x" + (BigInt(w || "0") * 10n ** 18n + BigInt((f + "0".repeat(18)).slice(0, 18))).toString(16);
};

export default function BaseTipSender({ toWallet, onSent }) {
  const [amount, setAmount] = useState("0.002");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setError("");
    if (!window.ethereum) { setError("No browser wallet found. Install MetaMask or Coinbase Wallet."); return; }
    if (!(Number(amount) > 0)) { setError("Enter an amount above 0"); return; }
    setBusy(true);
    try {
      const [from] = await window.ethereum.request({ method: "eth_requestAccounts" });
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] });
      const hash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from, to: toWallet, value: toWeiHex(amount) }],
      });
      await onSent(hash);
    } catch (e) {
      setError(e?.message || "Transaction cancelled");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-muted-foreground uppercase block">Amount (ETH on Base)</label>
      <Input type="number" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl" />
      <p className="text-[11px] text-muted-foreground font-mono break-all">To: {toWallet}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={send} disabled={busy} className="w-full rounded-xl gap-2">
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Waiting for wallet & confirmation…</> : "Send with my wallet"}
      </Button>
    </div>
  );
}