import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle, Wallet, Zap, Music2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import BaseTipSender from "@/components/tipping/BaseTipSender";
import SolanaTipSender from "@/components/tipping/SolanaTipSender";
import CardTipSender from "@/components/tipping/CardTipSender";
import { CreditCard } from "lucide-react";

const RAILS = [
  { key: "audius_handle", label: "Audius · $AUDIO", desc: "Native Audius tipping from your Audius wallet", icon: Music2 },
  { key: "base", label: "Base · ETH", desc: "Wallet to wallet (MetaMask, Coinbase Wallet)", icon: Wallet },
  { key: "solana", label: "Solana · SOL", desc: "Wallet to wallet (Phantom, Solflare)", icon: Zap },
];

export default function TipModal({ artist, onClose }) {
  const [wallets, setWallets] = useState(null);
  const [rail, setRail] = useState(null);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      const byUser = await base44.entities.ArtistProfile.filter({ user_id: artist.id });
      const p = byUser[0] || (await base44.entities.ArtistProfile.get(artist.id).catch(() => null));
      setWallets(p?.tipping_enabled === false || !p ? { enabled: false } : p.tip_wallets || {});
    })();
  }, [artist.id]);

  const available = wallets?.enabled === false ? [] : [
    ...RAILS.filter((r) => wallets?.[r.key]),
    { key: "card", label: "Card · USD", desc: "Pay with any card via Stripe", icon: CreditCard },
  ];

  const record = async (tx_hash) => {
    const res = await base44.functions.invoke("processTip", { artist_id: artist.id, blockchain: rail, tx_hash, message });
    if (!res.data?.success) throw new Error(res.data?.error || "Could not verify tip");
    setDone(res.data);
    toast.success("Tip verified on-chain!");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader><DialogTitle>Tip {artist.name}</DialogTitle></DialogHeader>

        {!wallets && <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}

        {wallets && !available.length && (
          <p className="text-sm text-muted-foreground py-4">This artist isn't accepting tips right now.</p>
        )}

        {done && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
            <p className="font-semibold">{done.amount} {done.symbol} sent to {artist.name}</p>
            <Button onClick={onClose} className="w-full rounded-xl">Done</Button>
          </div>
        )}

        {wallets && available.length > 0 && !done && !rail && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Your tip goes straight to the artist — BASE Station never holds it.</p>
            {available.map(({ key, label, desc, icon: Icon }) => (
              <button key={key} onClick={() => setRail(key === "audius_handle" ? "audius" : key)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-foreground/30 text-left">
                <Icon className="w-5 h-5" />
                <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
              </button>
            ))}
          </div>
        )}

        {rail && !done && (
          <div className="space-y-3">
            {rail !== "audius" && (
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message (optional)" rows={2} className="rounded-xl text-sm" />
            )}
            {rail === "base" && <BaseTipSender toWallet={wallets.base} onSent={record} />}
            {rail === "solana" && <SolanaTipSender toWallet={wallets.solana} onSent={record} />}
            {rail === "card" && <CardTipSender artistId={artist.id} message={message} />}
            {rail === "audius" && (
              <a href={`https://audius.co/${wallets.audius_handle}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-xl merc-button py-2.5 text-sm font-semibold">
                <ExternalLink className="w-4 h-4" /> Tip @{wallets.audius_handle} on Audius
              </a>
            )}
            <Button variant="outline" onClick={() => setRail(null)} className="w-full rounded-xl">← Other options</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}