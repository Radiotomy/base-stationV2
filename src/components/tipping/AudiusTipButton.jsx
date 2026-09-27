import { useState } from "react";
import { Coins, Loader2, CheckCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PRESETS = [5, 25, 100];
const getProvider = () => window.phantom?.solana || window.solflare || window.solana;

// $AUDIO tip straight from the fan's Solana wallet to an Audius artist's wallet.
// Works for any Audius artist — no Audius account needed on the fan's side.
export default function AudiusTipButton({ audiusUserId, artistName, trackTitle }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("25");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const send = async () => {
    setError("");
    if (!(await base44.auth.isAuthenticated())) { base44.auth.redirectToLogin(window.location.href); return; }
    const provider = getProvider();
    if (!provider) { setError("No Solana wallet found. Install Phantom or Solflare to tip $AUDIO."); return; }
    try {
      setStatus("Connecting wallet…");
      const { publicKey } = await provider.connect();
      setStatus("Preparing transfer…");
      const built = await base44.functions.invoke("buildAudiusTipTx", {
        audius_user_id: audiusUserId, from_wallet: publicKey.toString(), amount,
      });
      if (!built.data?.message) throw new Error(built.data?.error || "Could not prepare the tip");
      setStatus("Approve in your wallet…");
      const { signature } = await provider.request({ method: "signAndSendTransaction", params: { message: built.data.message } });
      setStatus("Verifying on Solana…");
      await new Promise((r) => setTimeout(r, 4000));
      const res = await base44.functions.invoke("processTip", {
        artist_id: audiusUserId, blockchain: "audius", tx_hash: signature, track_title: trackTitle || "",
      });
      if (!res.data?.success) throw new Error(res.data?.error || "Could not verify tip");
      setDone(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Tip cancelled");
    }
    setStatus("");
  };

  return (
    <>
      <Button variant="outline" onClick={() => { setOpen(true); setDone(null); }} className="rounded-xl gap-2">
        <Coins className="w-4 h-4" /> Tip $AUDIO
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>Tip {artistName} in $AUDIO</DialogTitle></DialogHeader>
          {done ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
              <p className="font-semibold">{done.amount} $AUDIO sent to {artistName}</p>
              <Button onClick={() => setOpen(false)} className="w-full rounded-xl">Done</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Sent from your Solana wallet directly to the artist's Audius wallet. BASE Station never holds it.</p>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button key={p} onClick={() => setAmount(String(p))}
                    className={`py-2 rounded-xl border text-sm font-semibold ${amount === String(p) ? "border-foreground bg-white/10" : "border-border"}`}>
                    {p}
                  </button>
                ))}
              </div>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl" />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button onClick={send} disabled={!!status || !(Number(amount) > 0)} className="w-full rounded-xl gap-2">
                {status ? <><Loader2 className="w-4 h-4 animate-spin" /> {status}</> : `Send ${amount} $AUDIO`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}