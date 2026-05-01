import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import {
  Zap, RefreshCw, CheckCircle, AlertCircle, Clock, TrendingUp,
  Users, Activity, BarChart3, Download, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PROVIDER_META = {
  loudly:    { label: "Loudly",     color: "bg-blue-500/20 text-blue-300 border-blue-500/30",    dot: "bg-blue-400" },
  nuro:      { label: "Nuro AI",    color: "bg-pink-500/20 text-pink-300 border-pink-500/30",    dot: "bg-pink-400" },
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

function StatCard({ icon: Icon, label, value, sub, color = "text-purple-400" }) {
  return (
    <div className="p-5 rounded-2xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
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
    const headers = ["timestamp", "user_email", "provider", "task", "status", "credits_used", "duration_ms"];
    const rows = filteredLogs.map(l => headers.map(h => l[h] ?? "").join(","));
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground">⚡ AI Integrations</h2>
          <p className="text-muted-foreground text-sm">Provider balances, usage logs & credit tracking</p>
        </div>
        <Button onClick={handleRefreshBalances} disabled={refreshing} variant="outline" className="rounded-xl gap-2">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Balances
        </Button>
      </div>

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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Total API Calls" value={stats.total.toLocaleString()} color="text-blue-400" />
        <StatCard icon={CheckCircle} label="Successful" value={stats.success.toLocaleString()}
          sub={stats.total ? `${Math.round(stats.success / stats.total * 100)}% success rate` : ""} color="text-emerald-400" />
        <StatCard icon={AlertCircle} label="Failed" value={stats.failed.toLocaleString()} color="text-red-400" />
        <StatCard icon={Zap} label="Credits Used" value={stats.credits.toLocaleString()} color="text-yellow-400" />
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
                  {["Timestamp", "User", "Provider", "Task", "Status", "Credits", "Duration"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.slice(0, 100).map(log => {
                  const meta = PROVIDER_META[log.provider] || { label: log.provider, color: "bg-muted text-muted-foreground border-border" };
                  return (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {log.created_date ? new Date(log.created_date).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground max-w-[120px] truncate">{log.user_email || log.user_name || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={`${meta.color} border text-xs`}>{meta.label}</Badge>
                      </td>
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
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : "—"}
                      </td>
                    </tr>
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
  );
}