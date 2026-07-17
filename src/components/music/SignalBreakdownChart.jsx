import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const SIGNAL_LABELS = {
  user_content:       'Own content (+40)',
  detailed_prompt:    'Detailed prompt (+15)',
  reference_material: 'Reference material (+15)',
  persona_used:       'Persona / template (+10)',
  custom_style:       'Custom style / tags (+10)',
  iteration:          'Iteration (+10)',
  basic_prompt:       'Basic prompt (+8)',
};

/**
 * Horizontal bar chart showing which creative signals the user earns
 * most often across their scored items.
 */
export default function SignalBreakdownChart({ items = [] }) {
  const counts = {};
  items.forEach(i => {
    Object.keys(i.participation_signals || {}).forEach(k => {
      counts[k] = (counts[k] || 0) + 1;
    });
  });

  const data = Object.keys(SIGNAL_LABELS)
    .map(k => ({ name: SIGNAL_LABELS[k], count: counts[k] || 0 }))
    .sort((a, b) => b.count - a.count);

  const hasAny = data.some(d => d.count > 0);

  return (
    <div className="p-5 rounded-2xl bg-card border border-border">
      <p className="text-sm font-bold text-foreground mb-1">Your Creative Signals</p>
      <p className="text-[11px] text-muted-foreground mb-3">How often each score-building signal appears in your work — grow the ones at zero to raise your average.</p>
      {hasAny ? (
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ background: '#1a140e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="count" fill="#34d399" radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-xs text-muted-foreground py-8 text-center">No signal data yet — newer generations record a full signal breakdown.</p>
      )}
    </div>
  );
}