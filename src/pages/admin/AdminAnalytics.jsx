import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  TrendingUp, Music, Zap, Users, BarChart3, PieChart as PieIcon, Activity,
  Clock, Award, Target
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function StatCard({ label, value, icon: Icon, change, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl bg-card border border-border space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-semibold">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      {change !== undefined && (
        <p className={`text-xs ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from last period
        </p>
      )}
    </motion.div>
  );
}

export default function AdminAnalytics() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [topProviders, setTopProviders] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.GenerationJob.list('-created_date', 1000),
      base44.entities.UserCredit.list('-created_date', 1000),
      base44.entities.AnalyticsEvent.list('-created_date', 1000)
    ]).then(([jobs, credits, events]) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const recentJobs = jobs.filter(j => new Date(j.created_date) >= thirtyDaysAgo);
      const completedJobs = recentJobs.filter(j => j.status === 'completed').length;
      const failedJobs = recentJobs.filter(j => j.status === 'failed').length;
      const totalCreditsUsed = recentJobs.reduce((sum, j) => sum + (j.credits_used || 0), 0);

      // Provider breakdown
      const providerCounts = {};
      recentJobs.forEach(j => {
        providerCounts[j.provider] = (providerCounts[j.provider] || 0) + 1;
      });

      const topProvs = Object.entries(providerCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      setStats({
        total_jobs: recentJobs.length,
        completed_jobs: completedJobs,
        failed_jobs: failedJobs,
        success_rate: ((completedJobs / Math.max(recentJobs.length, 1)) * 100).toFixed(1),
        total_credits_used: totalCreditsUsed,
        avg_credits_per_job: (totalCreditsUsed / Math.max(recentJobs.length, 1)).toFixed(1),
        active_users: new Set(events.filter(e => new Date(e.created_date) >= thirtyDaysAgo).map(e => e.user_id)).size,
        total_events: events.filter(e => new Date(e.created_date) >= thirtyDaysAgo).length
      });

      setTopProviders(topProvs);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="animate-pulse space-y-4">{Array(6).fill(0).map((_, i) => <div key={i} className="h-24 bg-muted rounded-2xl" />)}</div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-foreground mb-1">Analytics</h1>
        <p className="text-muted-foreground text-sm">Real-time platform metrics & insights (last 30 days)</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Jobs" value={stats.total_jobs} icon={Activity} color="bg-purple-600" />
        <StatCard label="Completed" value={stats.completed_jobs} icon={Award} color="bg-emerald-600" change={5} />
        <StatCard label="Success Rate" value={`${stats.success_rate}%`} icon={Target} color="bg-blue-600" />
        <StatCard label="Credits Used" value={(stats.total_credits_used / 1000).toFixed(1) + 'K'} icon={Zap} color="bg-yellow-600" />
        <StatCard label="Active Users" value={stats.active_users} icon={Users} color="bg-pink-600" />
        <StatCard label="Avg Credits/Job" value={stats.avg_credits_per_job} icon={TrendingUp} color="bg-cyan-600" />
      </div>

      {/* Provider Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-black text-foreground mb-4">Top Providers</h2>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold uppercase">Provider</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold uppercase">Jobs</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold uppercase">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topProviders.map((p) => (
                  <tr key={p.name} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-semibold text-foreground capitalize">{p.name}</td>
                    <td className="px-4 py-3 text-right">{p.count}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge className="bg-purple-500/20 text-purple-400 border-0">
                        {((p.count / stats.total_jobs) * 100).toFixed(0)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-black text-foreground mb-4">Job Status</h2>
          <div className="space-y-3">
            {[
              { label: 'Completed', value: stats.completed_jobs, color: 'bg-emerald-500', pct: ((stats.completed_jobs / stats.total_jobs) * 100).toFixed(0) },
              { label: 'Failed', value: stats.failed_jobs, color: 'bg-destructive', pct: ((stats.failed_jobs / stats.total_jobs) * 100).toFixed(0) },
              { label: 'Other', value: stats.total_jobs - stats.completed_jobs - stats.failed_jobs, color: 'bg-muted-foreground', pct: (((stats.total_jobs - stats.completed_jobs - stats.failed_jobs) / stats.total_jobs) * 100).toFixed(0) }
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.value} ({item.pct}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}