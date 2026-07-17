import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { ShieldCheck } from 'lucide-react';
import { SCORE_TIERS, getTier, OWNERSHIP_POLICY_TEXT } from '@/utils/participationScore';
import AiDisclosureBadge from '@/components/music/AiDisclosureBadge';
import ParticipationBadge from '@/components/music/ParticipationBadge';
import SignalBreakdownChart from '@/components/music/SignalBreakdownChart';

/**
 * Creative Ownership dashboard — tier breakdown, score distribution,
 * and creative evolution over time for scored items.
 */
export default function OwnershipDashboard({ items = [] }) {
  const scored = items.filter(i => i.human_participation_score != null);

  if (scored.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-2xl">
        <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground text-sm">No scored items yet — tracks you generate from now on get a Creative Ownership Score automatically.</p>
      </div>
    );
  }

  const avg = Math.round(scored.reduce((s, i) => s + i.human_participation_score, 0) / scored.length);
  const avgTier = getTier(avg);

  const tierCounts = SCORE_TIERS.map(t => ({
    ...t,
    count: scored.filter(i => i.human_participation_score >= t.min && i.human_participation_score <= t.max).length,
  }));

  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${i * 10 + 9}`,
    count: scored.filter(s => s.human_participation_score >= i * 10 && s.human_participation_score < (i + 1) * 10 + (i === 9 ? 1 : 0)).length,
  }));

  const evolution = [...scored]
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    .map((s, idx) => ({ n: idx + 1, score: s.human_participation_score }));

  const assistedCount = scored.filter(s => s.human_participation_score >= 40).length;

  return (
    <div className="space-y-6">
      {/* Policy statement */}
      <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground italic leading-relaxed">"{OWNERSHIP_POLICY_TEXT}"</p>
      </div>

      {/* Average + tier cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
          <ParticipationBadge score={avg} size={52} />
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Average Score</p>
            <p className="text-sm font-black" style={{ color: avgTier.color }}>{avgTier.emoji} {avgTier.label}</p>
          </div>
        </div>
        {tierCounts.map(t => (
          <div key={t.key} className="p-5 rounded-2xl bg-card border border-border" title={t.desc}>
            <p className="text-sm text-muted-foreground font-semibold">{t.emoji} {t.label}</p>
            <p className="text-2xl font-black" style={{ color: t.color }}>{t.count}</p>
            <p className="text-[10px] text-muted-foreground">score {t.min}–{t.max}</p>
          </div>
        ))}
      </div>

      {/* Human vs AI split */}
      <div className="p-5 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div>
            <p className="text-sm font-bold text-foreground">Overall Human vs AI Split</p>
            <p className="text-[11px] text-muted-foreground">Average across all {scored.length} scored item{scored.length === 1 ? '' : 's'}</p>
          </div>
          <p className="text-[11px] text-muted-foreground font-semibold">
            {assistedCount} AI-Assisted · {scored.length - assistedCount} AI-Generated
          </p>
        </div>
        <div className="h-4 rounded-full overflow-hidden flex bg-muted">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${avg}%` }} />
          <div className="h-full bg-blue-500/60 transition-all" style={{ width: `${100 - avg}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs font-bold">
          <span className="text-emerald-400">{avg}% Human Input</span>
          <span className="text-blue-400">{100 - avg}% AI Contribution</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border">
          <p className="text-sm font-bold text-foreground mb-3">Score Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ background: '#1a140e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="p-5 rounded-2xl bg-card border border-border">
          <p className="text-sm font-bold text-foreground mb-3">Creative Evolution</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={evolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="n" tick={{ fontSize: 10, fill: '#9ca3af' }} label={{ value: 'Item #', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#9ca3af' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ background: '#1a140e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="score" stroke="#34d399" fill="rgba(52,211,153,0.15)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Signal breakdown */}
      <SignalBreakdownChart items={scored} />

      {/* Recent scored items */}
      <div className="space-y-2">
        <p className="text-sm font-bold text-foreground">Scored Items</p>
        {scored.slice(0, 20).map(item => (
          <div key={item.id} className="p-3 rounded-xl bg-card border border-border flex items-center gap-3">
            <ParticipationBadge item={item} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{item.ai_disclosure_basis}</p>
            </div>
            <AiDisclosureBadge item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}