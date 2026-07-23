import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Zap, Crown, TrendingDown, TrendingUp, Clock, Star, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CREDIT_COSTS = [
  { task: "Generate Music (Quick)", credits: 10, icon: "🎵" },
  { task: "Generate Music (Advanced)", credits: 25, icon: "🎛️" },
  { task: "Generate Lyrics", credits: 5, icon: "📝" },
  { task: "Generate Cover Art (Basic)", credits: 3, icon: "🎨" },
  { task: "Generate Cover Art (HD)", credits: 15, icon: "🖼️" },
  { task: "Generate Video", credits: 50, icon: "🎬" },
  { task: "Stem Extraction", credits: 20, icon: "🎚️" },
  { task: "Voice Synthesis", credits: 8, icon: "🎤" },
  { task: "Audio Remix/Edit", credits: 15, icon: "🎧" },
];

function StatCard({ label, value, sub, icon: IconComp, color }) {
  return (
    <div className="p-5 rounded-2xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <IconComp className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted-foreground font-semibold uppercase">{label}</span>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function Credits() {
  const [creditData, setCreditData] = useState(null);
  const [creditLogs, setCreditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);
      if (!u) { setLoading(false); return; }

      const [credRes, logData] = await Promise.all([
        base44.functions.invoke("getUserCredits", {}),
        base44.entities.CreditLog.filter({ user_id: u.id }, "-created_date", 30),
      ]);
      setCreditData(credRes.data);
      setCreditLogs(logData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Zap className="w-12 h-12 mx-auto mb-4 text-yellow-400 opacity-50" />
        <p className="text-muted-foreground mb-4">Sign in to manage your credits</p>
        <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
      </div>
    </div>
  );

  const usagePct = creditData?.monthly_limit
    ? Math.min(100, Math.round((creditData.monthly_used || 0) / creditData.monthly_limit * 100))
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-yellow-950/60 via-background to-background pt-16 pb-12 px-6 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 px-3 py-1 text-xs">
              ⚡ Credits
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black text-foreground mb-2">Your Credit Balance</h1>
            <p className="text-muted-foreground">Power all AI generation features with credits.</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Balance Card */}
        <div className="relative p-8 rounded-3xl bg-gradient-to-br from-yellow-900/30 via-card to-card border border-yellow-500/20 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-semibold uppercase mb-2">Available Balance</p>
              <div className="flex items-baseline gap-2 mb-3">
                <Zap className="w-8 h-8 text-yellow-400 flex-shrink-0" />
                <span className="text-6xl font-black text-yellow-400">{(creditData?.balance || 0).toLocaleString()}</span>
                <span className="text-xl text-muted-foreground">credits</span>
              </div>
              {creditData?.is_premium && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
                  <Crown className="w-3 h-3" /> Premium Member
                </Badge>
              )}
            </div>
            <div className="flex-shrink-0 max-w-xs p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/25">
              <div className="flex items-center gap-2 mb-1.5">
                <Gift className="w-4 h-4 text-yellow-400" />
                <p className="text-sm font-black text-yellow-300">Open Beta</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                New accounts start with a <strong className="text-foreground">250-credit welcome bonus</strong>. During the beta, additional credits are allotted by the BASE Station team — purchases arrive after launch.
              </p>
            </div>
          </div>

          {/* Monthly usage bar */}
          {creditData?.monthly_limit && (
            <div className="relative mt-6 pt-6 border-t border-yellow-500/10">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Monthly Usage: {(creditData.monthly_used || 0).toLocaleString()} / {creditData.monthly_limit.toLocaleString()}</span>
                <span>{usagePct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full ${usagePct > 80 ? "bg-red-500" : usagePct > 50 ? "bg-yellow-500" : "bg-emerald-500"}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Zap}         label="Balance"       value={(creditData?.balance || 0).toLocaleString()}          color="text-yellow-400" />
          <StatCard icon={TrendingUp}  label="Lifetime Earned" value={(creditData?.lifetime_earned || 0).toLocaleString()} color="text-emerald-400" />
          <StatCard icon={TrendingDown} label="Lifetime Spent" value={(creditData?.lifetime_spent || 0).toLocaleString()}  color="text-red-400" />
          <StatCard icon={Star}        label="Monthly Limit"  value={(creditData?.monthly_limit || 1000).toLocaleString()}  color="text-purple-400"
            sub={creditData?.reset_date ? `Resets ${new Date(creditData.reset_date).toLocaleDateString()}` : "Resets monthly"} />
        </div>

        {/* Credit Cost Reference */}
        <div>
          <h3 className="text-lg font-black text-foreground mb-4">💡 Credit Costs by Feature</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {CREDIT_COSTS.map(item => (
              <div key={item.task} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{item.task}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-sm font-black text-yellow-400">{item.credits}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h3 className="text-lg font-black text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" /> Transaction History
          </h3>
          {creditLogs.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-2xl text-muted-foreground text-sm">
              No transactions yet — generate something to get started!
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {["Date", "Description", "Type", "Amount", "Balance"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {creditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground max-w-[200px] truncate">{log.description || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs capitalize ${
                          log.transaction_type === "purchase" ? "text-emerald-400 border-emerald-500/30" :
                          log.transaction_type === "refund" ? "text-blue-400 border-blue-500/30" :
                          log.transaction_type === "bonus" ? "text-yellow-400 border-yellow-500/30" :
                          "text-muted-foreground"
                        }`}>{log.transaction_type}</Badge>
                      </td>
                      <td className={`px-4 py-3 text-xs font-bold ${log.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {log.amount > 0 ? "+" : ""}{log.amount}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{log.balance_after?.toLocaleString() ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}