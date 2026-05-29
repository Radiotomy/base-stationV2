import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, RefreshCw, CheckCircle, AlertCircle, TrendingUp,
  Users, Activity, Download, Bell, ChevronDown, Shield, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import CostMatrixTab from "@/components/admin/CostMatrixTab";

const PROVIDER_META = {
  sonic:     { label: "Sonic",      color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",    dot: "bg-cyan-400" },
  producer:  { label: "Producer",   color: "bg-purple-500/20 text-purple-300 border-purple-500/30", dot: "bg-purple-400" },
  tempcolor: { label: "Tempolor",   color: "bg-orange-500/20 text-orange-300 border-orange-500/30", dot: "bg-orange-400" },
  ltx:       { label: "LTX Video",  color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  core:      { label: "Core (AI)",  color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", dot: "bg-yellow-400" },
};

const TASKS = ["all", "generate_music", "generate_lyrics", "generate_video", "generate_cover_art", "process_edits", "synthesize_voice"];

function StatusDot({ status }) {
  const colors = { active: "bg-emerald-400", error: "bg-red-400", inactive: "bg-gray-400", pending: "bg-yellow-400" };
  return <span className={`w-2 h-2 rounded-full inline-block ${colors[status] || "bg-gray-400"}`} />;
}

function LogRow({ log, meta, modelVersion, contentHash, outputDetails }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpanded(p => !p)}>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {log.created_date ? new Date(log.created_date).toLocaleString() : "—"}
        </td>
        <td className="px-4 py-3 text-xs text-foreground max-w-[120px] truncate">{log.user_email || log.user_name || "—"}</td>
        <td className="px-4 py-3">
          <Badge className={`${meta.color} border text-xs`}>{meta.label}</Badge>
        </td>
        <td className="px-4 py-3 text-xs font-mono text-cyan-400">{modelVersion}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{log.task || "—"}</td>
        <td className="px-4 py-3">
          <span className={`flex items-center gap-1 text-xs font-semibold ${
            log.status === "success" ? "text-emerald-400" :
            log.status === "failed" ? "text-red-400" : "text-yellow-400"
          }`}>
            <StatusDot status={log.status} />
            {log.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-yellow-400 font-bold">{log.credits_used ?? "—"}</td>
        <td className="px-4 py-3">
          <button className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
            <Shield className="w-3 h-3" />
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-4 py-3">
            <div className="space-y-2 text-xs font-mono">
              {contentHash && (
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-semibold">SHA-256:</span>
                  <span className="text-muted-foreground break-all">{contentHash}</span>
                </div>
              )}
              {log.metadata?.input_parameters && (
                <div>
                  <span className="text-blue-400 font-semibold">Input: </span>
                  <span className="text-muted-foreground">{JSON.stringify(log.metadata.input_parameters)}</span>
                </div>
              )}
              {outputDetails && (
                <div>
                  <span className="text-emerald-400 font-semibold">Output: </span>
                  <span className="text-muted-foreground">{JSON.stringify(outputDetails)}</span>
                </div>
              )}
              {log.metadata?.generated_timestamp && (
                <div>
                  <span className="text-yellow-400 font-semibold">Generated: </span>
                  <span className="text-muted-foreground">{new Date(log.metadata.generated_timestamp).toUTCString()}</span>
                </div>
              )}
              {log.metadata?.base44_job_id && (
                <div>
                  <span className="text-muted-foreground">Job ID: {log.metadata.base44_job_id}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StatCard({ label, value, sub, color = "text-purple-400", icon }) {
  const IconComp = icon;
  return (
    <div className="p-5 rounded-2xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        {IconComp && <IconComp className={`w-4 h-4 ${color}`} />}
        <span className="text-xs text-muted-foreground font-semibold uppercase">{label}</span>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminAIIntegrations() {
  const [balances, setBalances] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterTask, setFilterTask] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, credits: 0, users: new Set() });
  const [alertThreshold, setAlertThreshold] = useState(100);
  const [showAlertInput, setShowAlertInput] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [bal, logData] = await Promise.all([
      base44.entities.ProviderBalance.list("-last_checked", 20),
      base44.entities.APIUsageLog.list("-created_date", 200),
    ]);
    setBalances(bal);
    setLogs(logData);

    // Compute stats
    const total = logData.length;
    const success = logData.filter(l => l.status === "success").length;
    const failed = logData.filter(l => l.status === "failed").length;
    const credits = logData.reduce((s, l) => s + (l.credits_used || 0), 0);
    const users = new Set(logData.map(l => l.user_id));
    setStats({ total, success, failed, credits, users });
    setLoading(false);
  };

  const handleRefreshBalances = async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke("refreshProviderBalances", {});
      await loadData();
      toast.success("Provider balances refreshed!");
    } catch (err) {
      toast.error("Refresh failed: " + err.message);
    }
    setRefreshing(false);
  };

  const filteredLogs = logs.filter(l => {
    if (filterProvider !== "all" && l.provider !== filterProvider) return false;
    if (filterTask !== "all" && l.task !== filterTask) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = ["timestamp", "user_email", "provider", "task", "status", "credits_used", "duration_ms", "model_version", "content_hash"];
    const rows = filteredLogs.map(l => headers.map(h => {
      if (h === "model_version") return l.metadata?.model_version ?? "";
      if (h === "content_hash") return l.metadata?.content_hash ?? "";
      return l[h] ?? "";
    }).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "api_usage_log.csv"; a.click();
  };

  const providerUsage = Object.keys(PROVIDER_META).map(p => ({
    provider: p,
    count: logs.filter(l => l.provider === p).length,
    credits: logs.filter(l => l.provider === p).reduce((s, l) => s + (l.credits_used || 0), 0),
  })).sort((a, b) => b.count - a.count);

  // Top users by credits consumed
  const userMap = {};
  logs.forEach(l => {
    const key = l.user_email || l.user_id || "unknown";
    if (!userMap[key]) userMap[key] = { email: key, credits: 0, calls: 0 };
    userMap[key].credits += l.credits_used || 0;
    userMap[key].calls += 1;
  });
  const topUsers = Object.values(userMap).sort((a, b) => b.credits - a.credits).slice(0, 8);

  // Daily trends (last 14 days)
  const dailyMap = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailyMap[key] = { date: key, calls: 0, credits: 0 };
  }
  logs.forEach(l => {
    if (!l.created_date) return;
    const key = new Date(l.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (dailyMap[key]) {
      dailyMap[key].calls += 1;
      dailyMap[key].credits += l.credits_used || 0;
    }
  });
  const dailyTrends = Object.values(dailyMap);

  // Low balance providers
  const lowBalanceProviders = balances.filter(b => b.balance != null && b.balance < alertThreshold);

  const [activeTab, setActiveTab] = useState("usage");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground">⚡ AI Integrations</h2>
          <p className="text-muted-foreground text-sm">Provider balances, usage logs, cost matrix & credit tracking</p>
        </div>
        <Button onClick={handleRefreshBalances} disabled={refreshing} variant="outline" className="rounded-xl gap-2">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Balances
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "usage",  label: "📊 Usage & Logs" },
          { key: "costs",  label: "💰 Cost Matrix" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab === key ? "border-purple-500 text-purple-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "costs" && <CostMatrixTab />}
      {activeTab === "usage" && (<div className="space-y-8">

      {/* Provider Status Cards */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase mb-3">Provider Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(PROVIDER_META).filter(([k]) => k !== "core").map(([key, meta]) => {
            const bal = balances.find(b => b.provider === key);
            return (
              <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <StatusDot status={bal?.status || "inactive"} />
                  <span className="text-xs font-bold text-foreground">{meta.label}</span>
                </div>
                <p className="text-lg font-black text-foreground">
                  {bal?.balance != null ? bal.balance.toLocaleString() : "—"}
                </p>
                <p className="text-xs text-muted-foreground">credits</p>
                {bal?.last_checked && (
                  <p className="text-xs text-muted-foreground/60 mt-1 truncate">
                    {new Date(bal.last_checked).toLocaleTimeString()}
                  </p>
                )}
                {bal?.status === "error" && (
                  <p className="text-xs text-red-400 mt-1 truncate" title={bal.error_message}>⚠ Error</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Low Balance Alerts */}
      {lowBalanceProviders.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400 mb-1">⚠ Low Balance Alert</p>
            <p className="text-xs text-red-300">
              {lowBalanceProviders.map(b => `${PROVIDER_META[b.provider]?.label || b.provider} (${b.balance} credits)`).join(" · ")} — below {alertThreshold} threshold
            </p>
          </div>
          <button onClick={() => setShowAlertInput(p => !p)} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Bell className="w-3 h-3" /> Set threshold
          </button>
        </div>
      )}

      {showAlertInput && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
          <Bell className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span className="text-xs text-muted-foreground">Alert when balance below:</span>
          <input type="number" value={alertThreshold} onChange={e => setAlertThreshold(Number(e.target.value))}
            className="w-24 rounded-lg border border-input bg-muted/50 px-3 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          <button onClick={() => { setShowAlertInput(false); toast.success("Alert threshold saved!"); }}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">Save</button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Activity} label="Total API Calls" value={stats.total.toLocaleString()} color="text-blue-400" />
        <StatCard icon={CheckCircle} label="Successful" value={stats.success.toLocaleString()}
          sub={stats.total ? `${Math.round(stats.success / stats.total * 100)}% success rate` : ""} color="text-emerald-400" />
        <StatCard icon={AlertCircle} label="Failed" value={stats.failed.toLocaleString()} color="text-red-400" />
        <StatCard icon={Zap} label="Credits Used" value={stats.credits.toLocaleString()} color="text-yellow-400" />
        <StatCard icon={Users} label="Unique Users" value={stats.users.size.toLocaleString()} color="text-purple-400" />
        <StatCard icon={TrendingUp} label="Avg Credits/Call" value={stats.total ? (stats.credits / stats.total).toFixed(1) : "—"} color="text-cyan-400" />
      </div>

      {/* Provider Usage Breakdown */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase mb-3">Usage by Provider</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {providerUsage.map(({ provider, count, credits }) => {
            const meta = PROVIDER_META[provider] || { label: provider, color: "bg-muted text-muted-foreground border-border" };
            return (
              <div key={provider} className="p-4 rounded-2xl bg-card border border-border text-center">
                <Badge className={`${meta.color} border text-xs mb-2`}>{meta.label}</Badge>
                <p className="text-xl font-black text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">calls</p>
                <p className="text-xs text-yellow-400 font-semibold mt-1">{credits} cr</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Trends Chart */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase mb-3">Daily API Calls — Last 14 Days</h3>
        <div className="p-5 rounded-2xl bg-card border border-border">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyTrends} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="API Calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Users */}
      {topUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Top Users by Credit Consumption
          </h3>
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Rank", "User", "Credits Used", "API Calls", "Avg / Call"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topUsers.map((u, i) => (
                  <tr key={u.email} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-muted-foreground">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground max-w-[180px] truncate">{u.email}</td>
                    <td className="px-4 py-3 text-xs text-yellow-400 font-bold">{u.credits.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.calls}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.calls ? (u.credits / u.calls).toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Usage Logs Table */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-sm font-bold text-muted-foreground uppercase">API Usage Logs</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Provider Filter */}
            <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg bg-muted border border-border text-foreground">
              <option value="all">All Providers</option>
              {Object.entries(PROVIDER_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
            {/* Task Filter */}
            <select value={filterTask} onChange={e => setFilterTask(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg bg-muted border border-border text-foreground">
              {TASKS.map(t => <option key={t} value={t}>{t === "all" ? "All Tasks" : t}</option>)}
            </select>
            {/* Status Filter */}
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg bg-muted border border-border text-foreground">
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <Button onClick={exportCSV} variant="outline" size="sm" className="rounded-lg gap-1.5 text-xs">
              <Download className="w-3 h-3" /> Export CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array(8).fill(0).map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No API usage logs yet. Logs will appear as users generate content.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Timestamp", "User", "Provider", "Model Version", "Task", "Status", "Credits", "Provenance"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.slice(0, 100).map(log => {
                  const meta = PROVIDER_META[log.provider] || { label: log.provider, color: "bg-muted text-muted-foreground border-border" };
                  const modelVersion = log.metadata?.model_version || "—";
                  const contentHash = log.metadata?.content_hash;
                  const outputDetails = log.metadata?.output_details;
                  return (
                    <LogRow key={log.id} log={log} meta={meta} modelVersion={modelVersion} contentHash={contentHash} outputDetails={outputDetails} />
                  );
                })}
              </tbody>
            </table>
            {filteredLogs.length > 100 && (
              <p className="text-center text-xs text-muted-foreground py-3 border-t border-border">
                Showing 100 of {filteredLogs.length} logs. Export CSV for full data.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
      )}
    </div>
  );
}