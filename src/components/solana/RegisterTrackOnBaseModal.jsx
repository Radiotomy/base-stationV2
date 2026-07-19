import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle, ArrowRight, FileLock2, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function RegisterTrackOnBaseModal({ track, user, onClose, onSubmitted }) {
  const [step, setStep] = useState("confirm"); // confirm, processing, success, pending
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const registerOnBase = async () => {
    setProcessing(true);
    setStep("processing");
    try {
      const { data } = await base44.functions.invoke("registerOnBase", {
        action: "register",
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
      setResult(data);
      if (data.registration_status === "registered") {
        setStep("success");
        toast.success("Track registered on Base!");
        setTimeout(() => {
          onSubmitted?.();
          onClose();
        }, 3000);
      } else {
        setStep("pending");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Registration failed");
      setStep("confirm");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Register on Base <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Free</Badge>
          </DialogTitle>
          <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <p className="text-sm text-foreground mb-1"><strong>{track.title}</strong></p>
                <p className="text-xs text-muted-foreground">Artist: {user.full_name}</p>
              </div>
              <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  No wallet or crypto needed — Base Station covers the blockchain fees. Your track's
                  provenance record is pinned to IPFS and permanently anchored on the Base blockchain.
                </p>
              </div>
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
                <FileLock2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Registering your track…</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pinning provenance to IPFS and anchoring on Base — takes about 10–20 seconds
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
                <p className="font-semibold text-foreground">Saved — anchoring queued</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your provenance record was saved{result?.metadata_uri ? " and pinned to IPFS" : ""}, but the
                  blockchain anchor couldn't complete right now. It will be finished automatically — no action needed.
                </p>
              </div>
              {result?.gateway_url && (
                <a href={result.gateway_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:underline flex items-center gap-1 justify-center">
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
              {result?.basescan_url && (
                <a href={result.basescan_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline flex items-center gap-1 justify-center">
                  View on Basescan <ArrowRight className="w-3 h-3" />
                </a>
              )}
              {result?.gateway_url && (
                <a href={result.gateway_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:underline flex items-center gap-1 justify-center">
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