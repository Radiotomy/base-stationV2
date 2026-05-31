import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Coins, Plus, Minus, Edit3, Loader2, Check, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * Admin tool to grant / deduct / set a user's credit balance.
 * Props:
 *  - user: { id, email }
 *  - credit: current UserCredit record (or undefined)
 *  - onUpdated(newCredit): fired after successful change
 */
export default function AdminCreditEditor({ user, credit, onUpdated }) {
  const [mode, setMode] = useState("grant"); // grant | deduct | set
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const currentBalance = credit?.balance ?? 0;
  const isPremium = credit?.is_premium || false;

  const handleSubmit = async () => {
    const num = Number(amount);
    if (!Number.isFinite(num) || num < 0) {
      toast.error("Enter a valid non-negative number");
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("adminAdjustCredits", {
        target_user_id: user.id,
        action: mode,
        amount: num,
        reason: reason || undefined,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      toast.success(`Balance updated to ${data.balance.toLocaleString()} credits`);
      setAmount("");
      setReason("");
      onUpdated?.({ ...(credit || {}), balance: data.balance, lifetime_earned: data.lifetime_earned, lifetime_spent: data.lifetime_spent, is_premium: data.is_premium });
    } catch (e) {
      toast.error(e.message || "Failed to update credits");
    } finally {
      setSaving(false);
    }
  };

  const togglePremium = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("adminAdjustCredits", {
        target_user_id: user.id,
        action: "grant",
        amount: 0,
        is_premium: !isPremium,
        reason: `Toggled premium ${!isPremium ? "ON" : "OFF"}`,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      toast.success(`Premium ${!isPremium ? "enabled" : "disabled"}`);
      onUpdated?.({ ...(credit || {}), is_premium: data.is_premium });
    } catch (e) {
      toast.error(e.message || "Failed to toggle premium");
    } finally {
      setSaving(false);
    }
  };

  const previewBalance = (() => {
    const num = Number(amount);
    if (!Number.isFinite(num)) return currentBalance;
    if (mode === "grant") return currentBalance + num;
    if (mode === "deduct") return Math.max(0, currentBalance - num);
    if (mode === "set") return num;
    return currentBalance;
  })();

  return (
    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-black text-foreground">Manage Credits</h3>
        </div>
        <button
          onClick={togglePremium}
          disabled={saving}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 transition ${
            isPremium ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" : "bg-muted text-muted-foreground hover:text-foreground border border-border"
          }`}
        >
          <Crown className="w-3 h-3" />
          {isPremium ? "Premium" : "Free"}
        </button>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Current balance</span>
        <span className="font-black text-foreground text-base">{currentBalance.toLocaleString()}</span>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-1 bg-card border border-border rounded-xl p-1">
        {[
          { id: "grant", label: "Grant", icon: Plus },
          { id: "deduct", label: "Deduct", icon: Minus },
          { id: "set", label: "Set to", icon: Edit3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === id ? "bg-emerald-500/20 text-emerald-300" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          min="0"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg"
        />
        <Input
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-lg"
        />
      </div>

      {amount && (
        <div className="text-xs text-muted-foreground flex items-center justify-between px-1">
          <span>Preview new balance:</span>
          <span className="font-bold text-emerald-300">{previewBalance.toLocaleString()}</span>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={saving || !amount}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Apply
      </button>

      <p className="text-[10px] text-muted-foreground leading-snug">
        Actions are logged to <span className="font-mono">CreditLog</span> with your admin email.
      </p>
    </div>
  );
}