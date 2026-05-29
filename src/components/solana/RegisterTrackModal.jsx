import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, CheckCircle, ExternalLink, Sparkles, FileLock2 } from "lucide-react";
import { toast } from "sonner";

const GENRES = ["hip-hop","edm","pop","r&b","rock","lo-fi","jazz","classical","trap","other"];
const AI_TOOLS = ["Suno", "Udio", "ElevenLabs", "Riffusion", "Mureka", "Multiple", "Other"];

// Creates a provenance fingerprint and registers on-chain via memo program.
// The memo includes both the SHA-256 fingerprint AND the IPFS metadata CID,
// giving cryptographic + content-addressed provenance in a single on-chain write.
async function registerOnChain(walletAddress, metadata, ipfsCid) {
  // Encode metadata as JSON string for fingerprinting
  const metaStr = JSON.stringify(metadata);
  const encoder = new TextEncoder();
  const data = encoder.encode(metaStr);

  // Generate SHA-256 fingerprint
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  // Build a Solana transaction with a memo instruction (devnet)
  const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
  const { PublicKey, Transaction, TransactionInstruction, Connection } = await import(
    "https://esm.sh/@solana/web3.js@1.87.6"
  );

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const pubKey = new PublicKey(walletAddress);
  const memoProgramId = new PublicKey(MEMO_PROGRAM_ID);

  // Memo data = "AIVTV:<fingerprint64>:ipfs:<cid>" — combines hash + IPFS pointer
  const memoText = ipfsCid
    ? `AIVTV:${fingerprint.slice(0, 64)}:ipfs:${ipfsCid}`
    : `AIVTV:${fingerprint.slice(0, 64)}`;
  const memoData = new TextEncoder().encode(memoText);

  const instruction = new TransactionInstruction({
    keys: [{ pubkey: pubKey, isSigner: true, isWritable: false }],
    programId: memoProgramId,
    data: new Uint8Array(memoData),
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = pubKey;
  tx.add(instruction);

  // Sign & send via Phantom
  const signed = await window.solana.signAndSendTransaction(tx);
  await connection.confirmTransaction(signed.signature, "confirmed");

  return { signature: signed.signature, fingerprint };
}

export default function RegisterTrackModal({ walletAddress, user, onClose, onRegistered }) {
  const [step, setStep] = useState("form"); // form | pinning | signing | success
  const [form, setForm] = useState({ track_title: "", track_url: "", cover_image_url: "", genre: "", ai_tools_used: "", description: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.track_title || !form.track_url) { toast.error("Track title and URL are required"); return; }
    setError(null);

    try {
      const metadata = {
        title: form.track_title,
        artist: user.full_name,
        artist_id: user.id,
        track_url: form.track_url,
        genre: form.genre,
        ai_tools: form.ai_tools_used,
        platform: "AIVTV",
        registered_at: new Date().toISOString(),
      };

      // Step 1: Pin to IPFS first (content-addressed provenance)
      setStep("pinning");
      let ipfsData = { metadata_cid: "", metadata_uri: "", gateway_url: "" };
      try {
        const { data } = await base44.functions.invoke("pinToIPFS", {
          mode: "track",
          track: {
            title: form.track_title,
            artist: user.full_name,
            artist_id: user.id,
            file_url: form.track_url,
            cover_url: form.cover_image_url || "",
            genre: form.genre || "",
            ai_tools_used: form.ai_tools_used || "",
            description: form.description || "",
            blockchain: "solana",
          },
        });
        ipfsData = data || ipfsData;
      } catch (ipfsErr) {
        console.warn("IPFS pin failed, continuing without metadata_uri:", ipfsErr);
      }

      // Step 2: Sign Solana memo transaction (embedding the IPFS CID)
      setStep("signing");
      const { signature, fingerprint } = await registerOnChain(walletAddress, metadata, ipfsData.metadata_cid);

      // Step 3: Save to DB with IPFS metadata_uri
      const record = await base44.entities.SolanaTrackRegistry.create({
        ...form,
        artist_id: user.id,
        artist_name: user.full_name,
        artist_email: user.email,
        wallet_address: walletAddress,
        transaction_signature: signature,
        fingerprint_hash: fingerprint,
        metadata_uri: ipfsData.metadata_uri || "",
        registration_status: "registered",
        registered_at: new Date().toISOString(),
        network: "devnet",
      });

      setResult({ signature, fingerprint, record, ipfs: ipfsData });
      setStep("success");
      toast.success("Track registered on Solana + IPFS! 🎉");
      onRegistered?.();
    } catch (err) {
      console.error(err);
      setError(err.message || "Transaction failed or was rejected");
      setStep("form");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" /> Register Track On-Chain
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <form onSubmit={handleRegister} className="space-y-4 mt-2">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
              🔐 This writes a provenance fingerprint of your track to the Solana blockchain (devnet) via the SPL Memo Program. You'll pay a tiny gas fee (~0.000005 SOL).
            </div>
            {error && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive">{error}</div>}
            <div className="space-y-2">
              <Label>Track Title *</Label>
              <Input value={form.track_title} onChange={e => update("track_title", e.target.value)} placeholder="Your track name" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Track URL *</Label>
              <Input value={form.track_url} onChange={e => update("track_url", e.target.value)} placeholder="https://soundcloud.com/..." className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Genre</Label>
                <Select onValueChange={v => update("genre", v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>AI Tool</Label>
                <Select onValueChange={v => update("ai_tools_used", v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{AI_TOOLS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea value={form.description} onChange={e => update("description", e.target.value)} placeholder="About this track..." rows={2} className="rounded-xl" />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold gap-2">
                <Shield className="w-4 h-4" /> Register &amp; Sign
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            </div>
          </form>
        )}

        {step === "pinning" && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto animate-pulse">
              <FileLock2 className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="font-bold text-foreground">Pinning to IPFS…</p>
            <p className="text-sm text-muted-foreground">Creating a permanent, content-addressed copy of your track metadata before writing to Solana.</p>
          </div>
        )}

        {step === "signing" && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
            <p className="font-bold text-foreground">Approve in Phantom Wallet</p>
            <p className="text-sm text-muted-foreground">Check your Phantom extension and approve the transaction to write your track's fingerprint to Solana devnet.</p>
          </div>
        )}

        {step === "success" && result && (
          <div className="py-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-black text-foreground mb-1">Registered! 🎉</h3>
              <p className="text-sm text-muted-foreground">Your track is now permanently recorded on the Solana blockchain.</p>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-muted border border-border">
                <p className="text-xs text-muted-foreground mb-1 font-semibold">TRANSACTION SIGNATURE</p>
                <p className="text-xs text-foreground font-mono break-all">{result.signature}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted border border-border">
                <p className="text-xs text-muted-foreground mb-1 font-semibold">FINGERPRINT (SHA-256)</p>
                <p className="text-xs text-foreground font-mono break-all">{result.fingerprint.slice(0, 32)}…</p>
              </div>
              {result.ipfs?.metadata_cid && (
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <p className="text-xs text-cyan-300 mb-1 font-semibold flex items-center gap-1.5">
                    <FileLock2 className="w-3 h-3" /> IPFS METADATA CID
                  </p>
                  <p className="text-xs text-foreground font-mono break-all">{result.ipfs.metadata_cid}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              <a href={`https://solscan.io/tx/${result.signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[140px]">
                <Button variant="outline" className="w-full rounded-xl gap-2">
                  <ExternalLink className="w-4 h-4" /> View on Solscan
                </Button>
              </a>
              {result.ipfs?.gateway_url && (
                <a href={result.ipfs.gateway_url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[140px]">
                  <Button variant="outline" className="w-full rounded-xl gap-2 border-cyan-500/40 text-cyan-300">
                    <FileLock2 className="w-4 h-4" /> View on IPFS
                  </Button>
                </a>
              )}
              <Button onClick={onClose} className="flex-1 min-w-[120px] rounded-xl bg-purple-600 hover:bg-purple-500">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}