import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle, Wallet, Zap, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TIP_AMOUNTS = [5, 10, 25, 50, 100];

export default function TipModal({ artist, onClose }) {
  const [step, setStep] = useState("amount"); // amount, blockchain, confirm, processing, success
  const [amount, setAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [blockchain, setBlockchain] = useState("base");
  const [loading, setLoading] = useState(false);
  const [tipId, setTipId] = useState(null);

  const finalAmount = customAmount ? parseInt(customAmount) : amount;

  const handleNext = () => {
    if (finalAmount < 1) {
      toast.error("Minimum tip is $0.01");
      return;
    }
    setStep("blockchain");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setStep("processing");

    const payload = {
      artist_id: artist.id,
      artist_name: artist.name,
      artist_email: artist.email,
      amount_cents: finalAmount * 100,
      message,
      blockchain,
    };

    const res = await base44.functions.invoke("processTip", payload);
    
    if (res.data?.success) {
      setTipId(res.data.tip_id);
      setStep("success");
      toast.success(res.data.message);
    } else {
      toast.error(res.data?.error || "Failed to send tip");
      setStep("confirm");
    }
    setLoading(false);
  };

  const blockchainInfo = {
    base: { 
      icon: Wallet, 
      label: "Base Blockchain", 
      desc: "Fast, low-cost, on-chain tip",
      badge: "Primary",
      color: "bg-blue-500/10 border-blue-500/30 text-blue-400"
    },
    solana: { 
      icon: Zap, 
      label: "Solana Blockchain", 
      desc: "Ultra-fast, alternative chain",
      badge: "Secondary",
      color: "bg-purple-500/10 border-purple-500/30 text-purple-400"
    },
    fiat: { 
      icon: CreditCard, 
      label: "Credit Card", 
      desc: "Via Stripe (traditional payment)",
      badge: "Standard",
      color: "bg-slate-500/10 border-slate-500/30 text-slate-400"
    },
  };

  const selectedChain = blockchainInfo[blockchain];
  const SelectedIcon = selectedChain.icon;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Send a Tip
            <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-xs">❤️</Badge>
          </DialogTitle>
          <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Amount Step */}
          {step === "amount" && (
            <motion.div key="amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="p-3 rounded-xl bg-pink-500/5 border border-pink-500/20">
                <p className="text-sm font-semibold text-foreground">{artist.name}</p>
                <p className="text-xs text-muted-foreground">@{artist.email}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Select amount</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TIP_AMOUNTS.map(amt => (
                    <button key={amt} onClick={() => { setAmount(amt); setCustomAmount(""); }}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${amount === amt && !customAmount ? "bg-pink-600 text-white border-pink-600" : "border-border bg-card hover:border-pink-500/30"}`}>
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Or custom amount</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">$</span>
                  <Input type="number" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setAmount(0); }}
                    placeholder="0.00" className="rounded-xl" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Message (optional)</Label>
                <Textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Tell them why you're tipping..." rows={2} className="rounded-xl text-sm" />
              </div>

              <Button onClick={handleNext} className="w-full rounded-xl bg-pink-600 hover:bg-pink-500 text-white">
                Next: Choose Chain →
              </Button>
            </motion.div>
          )}

          {/* Blockchain Step */}
          {step === "blockchain" && (
            <motion.div key="blockchain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <p className="text-sm text-muted-foreground">How do you want to send this tip?</p>

              <RadioGroup value={blockchain} onValueChange={setBlockchain} className="space-y-3">
                {Object.entries(blockchainInfo).map(([key, info]) => {
                  const Icon = info.icon;
                  return (
                    <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${key === blockchain ? "bg-white/5 border-foreground/30" : "border-border hover:border-foreground/20"}`}>
                      <RadioGroupItem value={key} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon className="w-4 h-4" />
                          <p className="text-sm font-semibold text-foreground">{info.label}</p>
                          <Badge className={`text-xs px-1.5 py-0 ${info.color}`}>{info.badge}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{info.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("amount")} className="flex-1 rounded-xl">
                  ← Back
                </Button>
                <Button onClick={() => setStep("confirm")} className="flex-1 rounded-xl bg-pink-600 hover:bg-pink-500 text-white">
                  Confirm →
                </Button>
              </div>
            </motion.div>
          )}

          {/* Confirm Step */}
          {step === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-black text-lg">${finalAmount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">To</span>
                  <span className="text-sm font-semibold">{artist.name}</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Via</span>
                  <div className="flex items-center gap-2">
                    <SelectedIcon className="w-4 h-4" />
                    <span className="text-sm font-semibold">{selectedChain.label}</span>
                  </div>
                </div>
              </div>

              {message && (
                <div className="p-3 rounded-xl bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Your message:</p>
                  <p className="text-sm italic">"{message}"</p>
                </div>
              )}

              <Button onClick={handleSubmit} disabled={loading} className="w-full rounded-xl bg-pink-600 hover:bg-pink-500 text-white gap-2">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  <>Send Tip</>
                )}
              </Button>
              <Button variant="outline" onClick={() => setStep("blockchain")} className="w-full rounded-xl">
                Change Chain
              </Button>
            </motion.div>
          )}

          {/* Processing Step */}
          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 text-center py-6">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto animate-pulse">
                <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Processing your tip…</p>
                <p className="text-xs text-muted-foreground mt-1">Sending ${finalAmount} on {selectedChain.label}</p>
              </div>
            </motion.div>
          )}

          {/* Success Step */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-4 text-center py-6">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Tip sent! 🎉</p>
                <p className="text-xs text-muted-foreground mt-1">${finalAmount} to {artist.name}</p>
              </div>
              <Button onClick={onClose} className="w-full rounded-xl bg-pink-600 hover:bg-pink-500 text-white">
                Done
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}