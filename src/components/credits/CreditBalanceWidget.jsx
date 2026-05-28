import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Zap, Plus } from "lucide-react";
import { Link } from "react-router-dom";

// Simple module-level cache so multiple widget mounts don't fire duplicate requests
let _cachedBalance = null;
let _cachedPremium = false;
let _cacheTime = 0;
const CACHE_TTL = 60000; // 60 seconds

// Listeners for live balance updates after generations
const _listeners = new Set();

/** Invalidate the cached balance — call after any successful credit deduction. */
export function invalidateCreditBalance(newBalance) {
  _cacheTime = 0;
  if (typeof newBalance === 'number') {
    _cachedBalance = newBalance;
    _cacheTime = Date.now();
  }
  _listeners.forEach(fn => { try { fn(_cachedBalance); } catch {} });
}

export default function CreditBalanceWidget({ className = "" }) {
  const [balance, setBalance] = useState(_cachedBalance);
  const [isPremium, setIsPremium] = useState(_cachedPremium);
  const [loading, setLoading] = useState(_cachedBalance === null);

  useEffect(() => {
    const load = async (force = false) => {
      const now = Date.now();
      if (!force && _cachedBalance !== null && now - _cacheTime < CACHE_TTL) {
        setBalance(_cachedBalance);
        setIsPremium(_cachedPremium);
        setLoading(false);
        return;
      }
      try {
        const res = await base44.functions.invoke("getUserCredits", {});
        _cachedBalance = res.data.balance ?? 0;
        _cachedPremium = res.data.is_premium ?? false;
        _cacheTime = Date.now();
        setBalance(_cachedBalance);
        setIsPremium(_cachedPremium);
      } catch {
        setBalance(null);
      }
      setLoading(false);
    };
    load();

    // Listen for live invalidations (after a successful generation)
    const onUpdate = (newBalance) => {
      if (typeof newBalance === 'number') setBalance(newBalance);
      else load(true);
    };
    _listeners.add(onUpdate);
    return () => { _listeners.delete(onUpdate); };
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