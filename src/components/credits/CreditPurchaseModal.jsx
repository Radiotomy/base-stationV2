import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Crown, CheckCircle, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PACKAGES = [
  { id: "starter",  credits: 500,   price: "$4.99",  label: "Starter",  desc: "Try it out",       popular: false, color: "border-border" },
  { id: "creator",  credits: 1500,  price: "$9.99",  label: "Creator",  desc: "Most popular",     popular: true,  color: "border-purple-500" },
  { id: "pro",      credits: 5000,  price: "$24.99", label: "Pro",      desc: "Serious creators", popular: false, color: "border-border" },
  { id: "studio",   credits: 15000, price: "$59.99", label: "Studio",   desc: "Power users",      popular: false, color: "border-border" },
];

const SUBSCRIPTIONS = [
  { id: "creator_monthly", credits: 2000,  price: "$9.99/mo",  label: "Creator",  desc: "2,000 credits/month",  color: "from-purple-600 to-indigo-600" },
  { id: "pro_monthly",     credits: 8000,  price: "$29.99/mo", label: "Pro",      desc: "8,000 credits/month",  color: "from-pink-600 to-purple-600" },
  { id: "studio_monthly",  credits: 25000, price: "$79.99/mo", label: "Studio",   desc: "25,000 credits/month", color: "from-yellow-600 to-orange-600" },
];

export default function CreditPurchaseModal({ onClose, onPurchased }) {
  const [tab, setTab] = useState("packs");
  const [loading, setLoading] = useState(null);

  const handlePurchasePack = async (pkg) => {
    setLoading(pkg.id);
    try {
      const res = await base44.functions.invoke("purchaseCredits", {
        action: "purchase_pack",
        package_id: pkg.id,
        payment_method: "simulated",
      });
      toast.success(res.data.message || `${pkg.credits.toLocaleString()} credits added!`);
      if (onPurchased) onPurchased(res.data.new_balance);
      onClose();
    } catch (err) {
      toast.error(err.message || "Purchase failed");
    }
    setLoading(null);
  };

  const handleSubscribe = async (sub) => {
    setLoading(sub.id);
    try {
      const res = await base44.functions.invoke("purchaseCredits", {
        action: "activate_subscription",
        subscription_tier: sub.id,
        payment_method: "simulated",
      });
      toast.success(res.data.message || "Subscription activated!");
      if (onPurchased) onPurchased(res.data.new_balance);
      onClose();
    } catch (err) {
      toast.error(err.message || "Subscription failed");
    }
    setLoading(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }}
        className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="font-black text-foreground">Get Credits</h2>
              <p className="text-xs text-muted-foreground">Power your AI creations</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-border flex-shrink-0">
          {[["packs", "⚡ One-Time Packs"], ["subscriptions", "👑 Subscriptions"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {tab === "packs" ? (
            <>
              <p className="text-xs text-muted-foreground text-center pb-1">One-time credit top-ups. Credits never expire.</p>
              {PACKAGES.map(pkg => (
                <div key={pkg.id}
                  className={`relative p-4 rounded-2xl border-2 transition-all ${pkg.popular ? "border-purple-500 bg-purple-500/5" : "border-border bg-card"}`}>
                  {pkg.popular && (
                    <div className="absolute -top-3 left-4">
                      <Badge className="bg-purple-600 text-white text-xs px-2 py-0.5">⭐ Most Popular</Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-foreground">{pkg.label}</span>
                        <span className="text-xs text-muted-foreground">{pkg.desc}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="text-xl font-black text-yellow-400">{pkg.credits.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">credits</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handlePurchasePack(pkg)}
                      disabled={loading === pkg.id}
                      className={`rounded-xl font-bold flex-shrink-0 min-w-[90px] ${pkg.popular ? "bg-purple-600 hover:bg-purple-500" : ""}`}
                    >
                      {loading === pkg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : pkg.price}
                    </Button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground text-center pb-1">Monthly credits + premium features. Cancel anytime.</p>
              {SUBSCRIPTIONS.map(sub => (
                <div key={sub.id} className="relative p-4 rounded-2xl border border-border bg-card overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-r ${sub.color} opacity-5`} />
                  <div className="relative flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Crown className="w-4 h-4 text-yellow-400" />
                        <span className="font-black text-foreground">{sub.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{sub.desc}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {["Unlimited Saves", "Priority Generation", "No Watermarks"].map(f => (
                          <span key={f} className="flex items-center gap-0.5 text-xs text-emerald-400">
                            <CheckCircle className="w-3 h-3" /> {f}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleSubscribe(sub)}
                      disabled={loading === sub.id}
                      className={`rounded-xl font-bold flex-shrink-0 bg-gradient-to-r ${sub.color} border-0 text-white min-w-[110px]`}
                    >
                      {loading === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : sub.price}
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}

          <p className="text-center text-xs text-muted-foreground pt-2">
            🔒 Payments are processed securely. Demo mode — no real charges.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}