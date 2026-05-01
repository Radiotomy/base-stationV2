import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Zap, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export default function CreditBalanceWidget({ className = "" }) {
  const [balance, setBalance] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await base44.functions.invoke("getUserCredits", {});
        setBalance(res.data.balance ?? 0);
        setIsPremium(res.data.is_premium ?? false);
      } catch {
        setBalance(null);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading || balance === null) return null;

  const isLow = balance < 100;

  return (
    <Link
      to="/credits"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all hover:border-yellow-500/40 hover:bg-yellow-500/5 group ${
        isLow
          ? "border-red-500/40 bg-red-500/10"
          : isPremium
          ? "border-yellow-500/30 bg-yellow-500/10"
          : "border-border bg-muted/50"
      } ${className}`}
    >
      <Zap className={`w-3.5 h-3.5 flex-shrink-0 ${isLow ? "text-red-400" : isPremium ? "text-yellow-400" : "text-muted-foreground"}`} />
      <span className={`text-xs font-bold ${isLow ? "text-red-400" : isPremium ? "text-yellow-400" : "text-foreground"}`}>
        {balance.toLocaleString()}
      </span>
      {isPremium && <span className="text-xs text-yellow-500/70 font-medium hidden sm:block">PRO</span>}
      <Plus className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors ml-0.5" />
    </Link>
  );
}