import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Zap, Music, FileText, Image, Film, TrendingUp, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const PROVIDER_COLORS = {
  sonic:     '#06b6d4',
  tempcolor: '#f59e0b',
  producer:  '#a855f7',
  nuro:      '#ec4899',
  loudly:    '#3b82f6',
  core:      '#10b981',
};

const JOB_TYPE_CONFIG = {
  music:     { icon: Music,    color: 'text-cyan-400',    label: 'Music' },
  lyrics:    { icon: FileText, color: 'text-pink-400',    label: 'Lyrics' },
  cover_art: { icon: Image,    color: 'text-purple-400',  label: 'Cover Art' },
  video:     { icon: Film,     color: 'text-indigo-400',  label: 'Video' },
};

function StatPill({ label, value, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
      <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-black text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function UsageAnalytics({ userId }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    base44.entities.APIUsageLog.filter({ user_id: userId }, '-created_date', 200)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (logs.length === 0) return (
    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-2xl">
      <TrendingUp className="w-7 h-7 mx-auto mb-2 opacity-30" />
      No usage data yet — generate something to see analytics here.
    </div>
  );

  // Aggregate totals
  const totalCredits    = logs.reduce((s, l) => s + (l.credits_used || 0), 0);
  const successCount    = logs.filter(l => l.status === 'success').length;
  const failCount       = logs.filter(l => l.status === 'failed').length;

  // By provider
  const byProvider = logs.reduce((acc, l) => {
    acc[l.provider] = (acc[l.provider] || 0) + (l.credits_used || 0);
    return acc;
  }, {});
  const providerData = Object.entries(byProvider)
    .sort((a, b) => b[1] - a[1])
    .map(([provider, credits]) => ({ provider, credits }));

  // By task type
  const byTask = logs.reduce((acc, l) => {
    const t = l.task?.replace('generate_', '') || 'other';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  // Last 7 days daily activity
  const dailyMap = {};
  const now = Date.now();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dailyMap[key] = { day: key, credits: 0, count: 0 };
  }
  logs.forEach(l => {
    const d = new Date(l.created_date || l.timestamp);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (dailyMap[key]) {
      dailyMap[key].credits += l.credits_used || 0;
      dailyMap[key].count   += 1;
    }
  });
  const dailyData = Object.values(dailyMap);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-5 p-5 rounded-2xl bg-card border border-border">
      <h3 className="text-sm font-black text-foreground flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-purple-400" /> Usage Analytics
      </h3>

      {/* Summary pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Total Generations" value={successCount} icon={Zap} color="text-yellow-400" />
        <StatPill label="Credits Spent"     value={totalCredits} icon={Zap} color="text-cyan-400" />
        <StatPill label="Success Rate"      value={`${logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0}%`} icon={TrendingUp} color="text-emerald-400" />
        <StatPill label="Failed Calls"      value={failCount}    icon={Zap} color="text-red-400" />
      </div>

      {/* 7-day activity chart */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Credits Spent — Last 7 Days</p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
              formatter={(v) => [`${v} credits`, 'Spent']}
            />
            <Bar dataKey="credits" radius={[4, 4, 0, 0]}>
              {dailyData.map((_, i) => (
                <Cell key={i} fill="hsl(var(--primary))" fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Provider breakdown */}
      {providerData.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Credits by Provider</p>
          <div className="space-y-2">
            {providerData.map(({ provider, credits }) => {
              const pct = totalCredits > 0 ? Math.round((credits / totalCredits) * 100) : 0;
              return (
                <div key={provider} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground capitalize w-16 flex-shrink-0">{provider}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PROVIDER_COLORS[provider] || '#6b7280' }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right flex-shrink-0">{credits} cr</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}