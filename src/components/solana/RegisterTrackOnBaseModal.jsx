import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle, AlertCircle, ArrowRight, FileLock2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import BaseWalletConnectButton from "./BaseWalletConnectButton";

const BASE_CHAIN_ID = "0x2105"; // Base mainnet (8453)

export default function RegisterTrackOnBaseModal({ track, user, onClose, onSubmitted }) {
  const [step, setStep] = useState("connect"); // connect, confirm, processing, success, pending
  const [walletAddress, setWalletAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [ipfsGatewayUrl, setIpfsGatewayUrl] = useState("");
  const [processingStage, setProcessingStage] = useState(""); // "ipfs" | "chain"
  const [processing, setProcessing] = useState(false);

  const handleWalletConnected = (address) => {
    setWalletAddress(address);
    setStep("confirm");
  };

  const sendAnchorTx = async (anchorData) => {
    if (!window.ethereum) throw new Error("MetaMask not available");
    // Make sure we're on Base mainnet
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BASE_CHAIN_ID }],
      });
    } catch (switchErr) {
      if (switchErr?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: BASE_CHAIN_ID,
            chainName: "Base",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://mainnet.base.org"],
            blockExplorerUrls: ["https://basescan.org"],
          }],
        });
      } else {
        throw switchErr;
      }
    }
    // 0-value self-transaction carrying the provenance anchor in calldata
    return await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: walletAddress, to: walletAddress, value: "0x0", data: anchorData }],
    });
  };

  const registerOnBase = async () => {
    if (!walletAddress) {
      toast.error("Wallet not connected");
      return;
    }

    setProcessing(true);
    setStep("processing");

    // Step 1: server prepares — fingerprint + IPFS pin + pending registry record
    setProcessingStage("ipfs");
    let prep;
    try {
      const { data } = await base44.functions.invoke("registerOnBase", {
        action: "prepare",
        wallet_address: walletAddress,
        track: {
          title: track.title || "Untitled",
          track_url: track.track_url || "",
          cover_image_url: track.cover_image_url || "",
          genre: track.genre || "",
          ai_tools_used: track.ai_tools_used || "",
          ai_label: track.ai_label || undefined,
          description: track.description || "",
          asset_id: track.asset_id || null,
        },
      });
      prep = data;
      setIpfsGatewayUrl(prep.gateway_url || "");
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Preparation failed");
      setStep("confirm");
      setProcessing(false);
      return;
    }

    // Step 2: real on-chain anchor signed by the user's wallet
    setProcessingStage("chain");
    try {
      const hash = await sendAnchorTx(prep.anchor_data);
      setTxHash(hash);

      // Step 3: finalize the registry record with the real tx hash
      await base44.functions.invoke("registerOnBase", {
        action: "finalize",
        registry_id: prep.registry_id,
        transaction_hash: hash,
        wallet_address: walletAddress,
      });

      setStep("success");
      toast.success("Track registered on Base!");
      setTimeout(() => {
        onSubmitted?.();
        onClose();
      }, 2500);
    } catch (chainErr) {
      // The record stays "pending" — visible to admins for manual confirmation
      console.warn("On-chain anchor not completed:", chainErr);
      setStep("pending");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Register on Base <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Primary</Badge>
          </DialogTitle>
          <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "connect" && (
            <motion.div key="connect" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <p className="text-sm text-foreground mb-2"><strong>{track.title}</strong></p>
                <p className="text-xs text-muted-foreground">Artist: {user.full_name}</p>
              </div>
              <p className="text-sm text-muted-foreground">Connect your MetaMask wallet to register this track with immutable on-chain proof.</p>
              <BaseWalletConnectButton onConnected={handleWalletConnected} />
            </motion.div>
          )}

          {step === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                <p className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Wallet Connected
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Your provenance bundle will be pinned to IPFS, then your wallet will sign a small anchor
                transaction on Base mainnet embedding the provenance hash and metadata URI (gas only, no fee).
              </p>
              <Button onClick={registerOnBase} disabled={processing} className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl gap-2">
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Register on Base</>
                )}
              </Button>
              <Button variant="outline" onClick={onClose} className="w-full rounded-xl">Cancel</Button>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto animate-pulse">
                {processingStage === "ipfs"
                  ? <FileLock2 className="w-6 h-6 text-blue-400" />
                  : <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />}
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {processingStage === "ipfs" ? "Pinning to IPFS…" : "Awaiting wallet signature…"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {processingStage === "ipfs"
                    ? "Creating content-addressed provenance record"
                    : "Confirm the anchor transaction in MetaMask"}
                </p>
              </div>
            </motion.div>
          )}

          {step === "pending" && (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Saved as Pending</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your provenance bundle was pinned to IPFS, but the on-chain anchor wasn't completed.
                  The registration was saved and can be anchored later — an admin can also confirm it manually.
                </p>
              </div>
              {ipfsGatewayUrl && (
                <a href={ipfsGatewayUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:underline flex items-center gap-1 justify-center">
                  <FileLock2 className="w-3 h-3" /> View IPFS metadata
                </a>
              )}
              <Button variant="outline" onClick={() => { onSubmitted?.(); onClose(); }} className="w-full rounded-xl">Close</Button>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Registered! ✓</p>
                <p className="text-xs text-muted-foreground mt-1">Provenance hash & metadata URI anchored on Base</p>
              </div>
              {txHash && (
                <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline flex items-center gap-1 justify-center">
                  View on Basescan <ArrowRight className="w-3 h-3" />
                </a>
              )}
              {ipfsGatewayUrl && (
                <a href={ipfsGatewayUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:underline flex items-center gap-1 justify-center">
                  <FileLock2 className="w-3 h-3" /> View IPFS metadata
                </a>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}