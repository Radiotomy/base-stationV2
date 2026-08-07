import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const LAYER_LABEL = {
  spectral: 'V1 Spectral',
  neural: 'V2 Neural',
  drift: 'V3 Drift (slot recovery)',
  speed: 'V4 Speed',
};

// Marked rows only — null rows carry no payload to recover, so including them
// would read as a wall of 0% failures.
export default function RobustnessPanel({ rows, layer }) {
  const marked = rows.filter((r) => r.attack !== 'null_unmarked' && r.layer === layer);
  const byAttack = {};
  for (const r of marked) {
    const k = r.attack_label || r.attack;
    byAttack[k] = byAttack[k] || { trials: 0, survived: 0 };
    byAttack[k].trials += r.trials || 1;
    byAttack[k].survived += r.survived || 0;
  }
  const data = Object.entries(byAttack)
    .map(([attack, v]) => ({
      attack: attack.length > 34 ? `${attack.slice(0, 32)}…` : attack,
      pct: v.trials ? Math.round((v.survived / v.trials) * 100) : 0,
      trials: v.trials,
    }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="merc-card rounded-xl p-5">
      <p className="font-bold text-foreground text-sm">{LAYER_LABEL[layer] || layer} — measured recovery by attack</p>
      <p className="text-xs text-muted-foreground mb-3">
        Aggregated across every recorded run. A trial counts as survived only on an exact payload match
        {layer === 'drift' ? ' (slot match for the Drift layer).' : '.'} Bars pool runs of different
        source material, so a low bar can mean a hard master rather than a fragile layer.
      </p>
      {data.length ? (
        <>
          <div style={{ height: Math.max(180, data.length * 26 + 30) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#B8A899', fontSize: 11 }} />
                <YAxis type="category" dataKey="attack" width={190} tick={{ fill: '#B8A899', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1A140E', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#F5E5C7' }}
                  formatter={(v, n, p) => [`${v}% (n=${p.payload.trials})`, 'Recovered']}
                />
                <Bar dataKey="pct" radius={[0, 3, 3, 0]}>
                  {data.map((d) => (
                    <Cell key={d.attack} fill={d.pct >= 85 ? '#34d399' : d.pct > 0 ? '#fbbf24' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {marked.length} rows pooled across {new Set(marked.map((r) => r.run_id)).size} runs.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground py-4">No rows recorded for this layer yet.</p>
      )}
    </div>
  );
}